# Third-party notices

This application uses open-source software. The original floor-plan photograph was supplied by the project owner. All building and furniture geometry and procedural texture maps in this project are created in the source code; no paid model library, remote texture CDN, API key, or image-generation service is required.

| Package | Pinned version | License | Upstream |
| --- | --- | --- | --- |
| React / React DOM | 19.1.1 | MIT | https://github.com/facebook/react |
| Three.js | 0.180.0 | MIT | https://github.com/mrdoob/three.js |
| Lucide React | 0.468.0 | ISC | https://github.com/lucide-icons/lucide |
| Vite | 6.1.0 | MIT | https://github.com/vitejs/vite |
| TypeScript | 5.9.2 | Apache-2.0 | https://github.com/microsoft/TypeScript |

Exact dependency versions and transitive packages are recorded in `package-lock.json`. Each installed package includes its own license. The optional offline GLB exporter uses `@napi-rs/canvas`; this package is only needed for that optional export command. The web application's GLB download works without it.

The reference floor plan is retained solely as the basis for this requested reconstruction. Its branding and original drawing are not represented as newly authored content.
