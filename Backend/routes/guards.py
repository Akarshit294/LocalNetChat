def same_origin(origin: str | None, host: str | None) -> bool:
    """Did our own page send this? The browser writes Origin, and a page can't change it."""
    return bool(origin and host) and origin == f"https://{host}"