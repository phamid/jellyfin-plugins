# Security Policy

Please report suspected vulnerabilities privately through GitHub's security
advisory feature for this repository. Do not include access tokens, cookies,
private media URLs, or personal library data in public issues.

The server plugin exposes its embedded browser script only to authenticated
Jellyfin sessions. File Transformation is used to add the authenticated loader
without modifying Jellyfin Web files on disk. Review tagged source and install
plugins only from trusted repositories.
