# Constellation background

Source: [d3-celestial by Olaf Frohn](https://github.com/ofrohn/d3-celestial).
The original `stars.6.json` (5,044 stars) and `constellations.lines.json` are included with the upstream BSD license in `LICENSE`.

Run `node assets/sky/build-sky.mjs` to rebuild `constellation-sky.svg`.
Positions use an equirectangular projection of catalog right ascension and declination; brightness is styled from magnitude and colors from B−V. Constellation connections are conventional chart guides.

This is a fixed decorative sky chart, not a simulation of the sky at the viewer's current location or time. It does not rotate with the Earth camera. No runtime external requests are needed for the sky.
