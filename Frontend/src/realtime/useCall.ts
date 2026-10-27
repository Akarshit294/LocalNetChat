import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast/headless';
import type { ClientMessage, ServerMessage } from '../lib/messages.ts';

// One voice or video call between two people, peer to peer.
//
// The socket carries only the notes that set a call up and end it: the offer,
// the answer, each candidate, and "it's over". The sound and the picture never
// go near the server. They travel between the two browsers, on the
// RTCPeerConnection made here.

export type CallPhase =
    | 'idle'
    | 'calling'      // we rang them, and they haven't picked up yet
    | 'ringing'      // they rang us
    | 'connecting'   // picked up: ICE is finding a road, then DTLS agrees the keys
    | 'connected';   // sound and picture are flowing

// the call as something to draw
type CallView = {
    phase: CallPhase;
    peerId: string;
    video: boolean;                     // false is a voice call
    localStream: MediaStream | null;    // our own camera and microphone
    remoteStream: MediaStream | null;   // theirs
    muted: boolean;
    cameraOff: boolean;
};

export type Call = CallView & {
    start: (userId: string, video: boolean) => void;
    pickUp: () => void;
    hangUp: () => void;   // also how you decline, and how you cancel
    toggleMute: () => void;
    toggleCamera: () => void;
};

const NO_CALL: CallView = {
    phase: 'idle',
    peerId: '',
    video: false,
    localStream: null,
    remoteStream: null,
    muted: false,
    cameraOff: false,
};

// the same call as the objects that carry it
type Live = {
    pc: RTCPeerConnection | null;
    peerId: string;   // '' when we're free
    stream: MediaStream | null;
};

const NOTHING_LIVE: Live = { pc: null, peerId: '', stream: null };

export function useCall(send: (message: ClientMessage) => void) {
    const [view, setView] = useState<CallView>(NO_CALL);
    // A ref, not state: the functions below are run by the socket and by the peer
    // connection, long after the render that made them. A ref is the same object
    // in every render, so whichever copy runs, it reads the call as it is now.
    const live = useRef<Live>(NOTHING_LIVE);

    // Ask for the microphone, and the camera too for a video call.
    async function openMedia(video: boolean) {
        // the browser only offers these to a secure page: https, or localhost
        if (!navigator.mediaDevices) {
            toast.error('Calls need this page opened over https');
            return null;
        }
        try {
            return await navigator.mediaDevices.getUserMedia({ audio: true, video });
        } catch {
            toast.error(video ? "Couldn't use the camera and microphone" : "Couldn't use the microphone");
            return null;
        }
    }

    // One RTCPeerConnection per call.
    function openConnection(peerId: string) {
        // No iceServers, so no STUN and no TURN. That leaves only host candidates,
        // this device's own address on the Wi-Fi, and with both ends on one
        // network that is the road that works.
        const pc = new RTCPeerConnection({ iceServers: [] });
        live.current = { pc, peerId, stream: null };

        // the browser finds its addresses one at a time, and each goes out as it's found
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                send({ type: 'call_candidate', user_id: peerId, candidate: event.candidate.toJSON() });
            }
        };

        // their microphone and camera, arriving as the tracks of one stream
        pc.ontrack = (event) => {
            setView((before) => ({ ...before, remoteStream: event.streams[0] }));
        };

        // "connected" means ICE found a pair of addresses that answers and DTLS
        // finished on it. "failed" means no pair ever did.
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                setView((before) => ({ ...before, phase: 'connected' }));
            } else if (pc.connectionState === 'failed') {
                toast.error("The call couldn't connect");
                hangUp();
            }
        };

        return pc;
    }

    // Turn on our microphone and camera, and put them on the connection.
    // False if the call can't go on.
    async function shareMedia(pc: RTCPeerConnection, video: boolean) {
        const stream = await openMedia(video);
        if (live.current.pc !== pc) {
            // the call ended while the permission prompt was showing
            stream?.getTracks().forEach((track) => track.stop());
            return false;
        }
        if (!stream) {
            hangUp();
            return false;
        }
        live.current.stream = stream;
        setView((before) => ({ ...before, localStream: stream }));
        // each track becomes one m= line of the SDP
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        return true;
    }

    async function start(peerId: string, video: boolean) {
        if (live.current.peerId) {
            return;   // one call at a time
        }
        const pc = openConnection(peerId);
        setView({ ...NO_CALL, phase: 'calling', peerId, video });
        try {
            if (await shareMedia(pc, video)) {
                const offer = await pc.createOffer();   // the browser writes the whole SDP
                await pc.setLocalDescription(offer);    // and from here it starts finding candidates
                send({ type: 'call_offer', user_id: peerId, sdp: offer.sdp! });
            }
        } catch (error) {
            fail(pc, error);
        }
    }

    async function pickUp() {
        const { pc, peerId } = live.current;
        if (!pc || view.phase !== 'ringing') {
            return;
        }
        setView((before) => ({ ...before, phase: 'connecting' }));
        try {
            if (await shareMedia(pc, view.video)) {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                send({ type: 'call_answer', user_id: peerId, sdp: answer.sdp! });
            }
        } catch (error) {
            fail(pc, error);
        }
    }

    // Hanging up, and also declining a call or cancelling one we started.
    function hangUp() {
        const { peerId } = live.current;
        if (peerId) {
            send({ type: 'call_end', user_id: peerId });
            cleanUp();
        }
    }

    // Let go of everything the call was holding, whoever ended it.
    function cleanUp() {
        const { pc, stream } = live.current;
        pc?.close();
        // stopping the tracks is what turns the camera light off
        stream?.getTracks().forEach((track) => track.stop());
        live.current = NOTHING_LIVE;
        setView(NO_CALL);
    }

    // Something inside the call threw. If we had already hung up, it threw
    // because we closed the connection under it, and there is nothing to say.
    function fail(pc: RTCPeerConnection, error: unknown) {
        if (live.current.pc === pc) {
            console.error('Call failed:', error);
            toast.error('The call broke');
            hangUp();
        }
    }

    // A disabled track sends silence, or black frames, in place of the real
    // thing. The call stays exactly as it was agreed, so nothing is renegotiated.
    function toggleMute() {
        const track = live.current.stream?.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setView((before) => ({ ...before, muted: !track.enabled }));
        }
    }

    function toggleCamera() {
        const track = live.current.stream?.getVideoTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setView((before) => ({ ...before, cameraOff: !track.enabled }));
        }
    }

    // Everything the server sends passes through here. Most of it isn't about a call.
    function onMessage(message: ServerMessage) {
        const { pc, peerId } = live.current;

        if (message.type === 'users') {
            // if the person on the other end has gone, nothing else will tell us
            if (peerId && !message.users.some((user) => user.id === peerId)) {
                toast('They left, so the call ended');
                cleanUp();
            }
        } else if (message.type === 'error') {
            // An error doesn't say which request it refused. But while our offer
            // is out and unanswered the call panel is all we can press, so the
            // refusal is about the call, and there is nobody left to wait for.
            if (pc?.signalingState === 'have-local-offer') {
                hangUp();
            }
        } else if (message.type === 'call_offer') {
            if (peerId) {
                // already in a call, so this one is turned away
                send({ type: 'call_end', user_id: message.from_id });
                return;
            }
            const incoming = openConnection(message.from_id);
            // Taken in now, before anyone has picked up: their candidates arrive
            // right behind the offer, and a candidate can only be added to a
            // connection that already knows the offer.
            incoming
                .setRemoteDescription({ type: 'offer', sdp: message.sdp })
                .catch((error) => fail(incoming, error));
            setView({
                ...NO_CALL,
                phase: 'ringing',
                peerId: message.from_id,
                // a video call's offer has an m=video line, a voice call's doesn't
                video: /^m=video/m.test(message.sdp),
            });
        } else if (
            message.type === 'call_answer' ||
            message.type === 'call_candidate' ||
            message.type === 'call_end'
        ) {
            // only the person we're in a call with has a say in it
            if (!pc || message.from_id !== peerId) {
                return;
            }
            if (message.type === 'call_answer') {
                setView((before) => ({ ...before, phase: 'connecting' }));
                pc.setRemoteDescription({ type: 'answer', sdp: message.sdp }).catch((error) => fail(pc, error));
            } else if (message.type === 'call_candidate') {
                // one road that turns out to be unusable isn't a reason to end the call
                pc.addIceCandidate(message.candidate).catch((error) => console.error('Bad candidate:', error));
            } else {
                toast('The call was ended from the other side');
                cleanUp();
            }
        }
    }

    const call: Call = { ...view, start, pickUp, hangUp, toggleMute, toggleCamera };

    // `drop` ends the call here without telling the other side, for when the
    // socket that would have carried the news has gone
    return { call, onMessage, drop: cleanUp };
}
