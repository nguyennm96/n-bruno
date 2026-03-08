<br />
<img src="assets/images/logo-transparent.png" width="80"/>

### Bruno - Opensource IDE for exploring and testing APIs.

[![GitHub version](https://badge.fury.io/gh/usebruno%2Fbruno.svg)](https://badge.fury.io/gh/usebruno%2Fbruno)
[![CI](https://github.com/usebruno/bruno/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/usebruno/bruno/actions/workflows/tests.yml)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/usebruno/bruno)](https://github.com/usebruno/bruno/pulse)
[![X](https://img.shields.io/twitter/follow/use_bruno?style=social&logo=x)](https://twitter.com/use_bruno)
[![Website](https://img.shields.io/badge/Website-Visit-blue)](https://www.usebruno.com)
[![Download](https://img.shields.io/badge/Download-Latest-brightgreen)](https://www.usebruno.com/downloads)

**English**
| [Українська](docs/readme/readme_ua.md)
| [Русский](docs/readme/readme_ru.md)
| [Türkçe](docs/readme/readme_tr.md)
| [Deutsch](docs/readme/readme_de.md)
| [Français](docs/readme/readme_fr.md)
| [Português (BR)](docs/readme/readme_pt_br.md)
| [한국어](docs/readme/readme_kr.md)
| [বাংলা](docs/readme/readme_bn.md)
| [Español](docs/readme/readme_es.md)
| [Italiano](docs/readme/readme_it.md)
| [Română](docs/readme/readme_ro.md)
| [Polski](docs/readme/readme_pl.md)
| [简体中文](docs/readme/readme_cn.md)
| [正體中文](docs/readme/readme_zhtw.md)
| [العربية](docs/readme/readme_ar.md)
| [日本語](docs/readme/readme_ja.md)
| [ქართული](docs/readme/readme_ka.md)
| [Nederlands](docs/readme/readme_nl.md)
| [فارسی](docs/readme/readme_fa.md)

Bruno is a new and innovative API client, aimed at revolutionizing the status quo represented by Postman and similar tools out there.

Bruno stores your collections directly in a folder on your filesystem. We use a plain text markup language, Bru, to save information about API requests.

You can use Git or any version control of your choice to collaborate over your API collections.

Bruno supports two modes:
- **Local mode** — fully offline, no account required; all data stays on your device
- **Cloud mode** — optional account; enables cloud workspaces, team collaboration, cloud sync, and published documentation

[Download Bruno](https://www.usebruno.com/downloads)

📢 Watch our recent talk at India FOSS 3.0 Conference [here](https://www.youtube.com/watch?v=7bSMFpbcPiY)

![bruno](assets/images/landing-2-dark.png#gh-light-mode-only)
![bruno](assets/images/landing-2-light.png#gh-dark-mode-only) <br /><br />

## Commercial Versions ✨

Majority of our features are free and open source.
We strive to strike a harmonious balance between [open-source principles and sustainability](https://github.com/usebruno/bruno/discussions/269)

You can explore our [paid versions](https://www.usebruno.com/pricing) to see if there are additional features that you or your team may find useful! <br/>

## Table of Contents

- [Installation](#installation)
- [Features](#features)
  - [Run across multiple platforms 🖥️](#run-across-multiple-platforms-%EF%B8%8F)
  - [Collaborate via Git 👩‍💻🧑‍💻](#collaborate-via-git-%E2%80%8D%E2%80%8D)
  - [Cloud Features ☁️](#cloud-features-%EF%B8%8F)
- [Important Links 📌](#important-links-)
- [Showcase 🎥](#showcase-)
- [Share Testimonials 📣](#share-testimonials-)
- [Publishing to New Package Managers](#publishing-to-new-package-managers)
- [Stay in touch 🌐](#stay-in-touch-)
- [Trademark](#trademark)
- [Contribute 👩‍💻🧑‍💻](#contribute-%E2%80%8D%E2%80%8D)
- [Authors](#authors)
- [License 📄](#license-)

## Installation

Bruno is available as binary download [on our website](https://www.usebruno.com/downloads) for Mac, Windows and Linux.

You can also install Bruno via package managers like Homebrew, Chocolatey, Scoop, Snap, Flatpak and Apt.

```sh
# On Mac via Homebrew
brew install bruno

# On Windows via Chocolatey
choco install bruno

# On Windows via Scoop
scoop bucket add extras
scoop install bruno

# On Windows via winget
winget install Bruno.Bruno

# On Linux via Snap
snap install bruno

# On Linux via Flatpak
flatpak install com.usebruno.Bruno

# On Arch Linux via AUR
yay -S bruno

# On Linux via Apt
sudo mkdir -p /etc/apt/keyrings
sudo apt update && sudo apt install gpg curl
curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x9FA6017ECABE0266" \
  | gpg --dearmor \
  | sudo tee /etc/apt/keyrings/bruno.gpg > /dev/null
sudo chmod 644 /etc/apt/keyrings/bruno.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/bruno.gpg] http://debian.usebruno.com/ bruno stable" \
  | sudo tee /etc/apt/sources.list.d/bruno.list
sudo apt update && sudo apt install bruno
```

## Features

### Run across multiple platforms 🖥️

![bruno](assets/images/run-anywhere.png) <br /><br />

### Collaborate via Git 👩‍💻🧑‍💻

Or any version control system of your choice

![bruno](assets/images/version-control.png) <br /><br />

### Protocol Support
- **HTTP/REST** — all methods, query params, headers, body (JSON, form, multipart, binary)
- **GraphQL** — queries, mutations, subscriptions, introspection docs viewer
- **gRPC** — unary and streaming calls with Protobuf support
- **WebSocket** — full-duplex connections with message history

### Authentication
- Basic Auth, Bearer Token, API Key
- OAuth2 (Authorization Code, Client Credentials, Password, Implicit)
- AWS Signature v4, NTLM, Digest, WSSE
- Per-collection auth inheritance

### Scripting & Testing
- Pre-request & post-response JavaScript scripts (`bruno-js` sandbox)
- Test blocks with assertions; declarative assert rules
- Runtime variable assignment; `.env` file integration

### Collections & Environments
- Collections stored as `.bru` or YAML files on filesystem
- Hierarchical folder structure with per-folder settings
- Collection-level & global environments with variable interpolation
- Import from Postman v2.1, Insomnia, OpenAPI; export to multiple formats
- CLI runner for headless execution (CI/CD)

### Developer Tools
- Response timeline, cookie jar, code generation (curl, etc.)
- API Spec viewer (OpenAPI/Swagger inline)
- Embedded terminal, DevTools console, network inspector
- Global search, multiple tabs with draft state
- Light/dark themes, custom keybindings, i18n support

### Cloud Features ☁️

Requires a Bruno Cloud account (opt-in):

- **Cloud Workspaces** — shared workspaces with role-based access (Owner / Editor / Viewer)
- **Real-time Sync** — WebSocket-based live synchronization across devices and team members
- **Collection Sharing** — share and collaborate on collections within a workspace
- **Publish Docs** — publish collection documentation to a public URL with custom slug, CSS, logo, password protection, and view analytics
- **Import/Export** — export collections to Postman, OpenAPI 3.0, or Swagger 2.0 formats

## Important Links 📌

- [Our Long Term Vision](https://github.com/usebruno/bruno/discussions/269)
- [Roadmap](https://www.usebruno.com/roadmap)
- [Documentation](https://docs.usebruno.com)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/bruno)
- [Website](https://www.usebruno.com)
- [Pricing](https://www.usebruno.com/pricing)
- [Download](https://www.usebruno.com/downloads)

## Showcase 🎥

- [Testimonials](https://github.com/usebruno/bruno/discussions/343)
- [Knowledge Hub](https://github.com/usebruno/bruno/discussions/386)
- [Scriptmania](https://github.com/usebruno/bruno/discussions/385)

## Share Testimonials 📣

If Bruno has helped you at work and your teams, please don't forget to share your [testimonials on our GitHub discussion](https://github.com/usebruno/bruno/discussions/343)

## Publishing to New Package Managers

Please see [here](publishing.md) for more information.

## Stay in touch 🌐

[𝕏 (Twitter)](https://twitter.com/use_bruno) <br />
[Website](https://www.usebruno.com) <br />
[Discord](https://discord.com/invite/KgcZUncpjq) <br />
[LinkedIn](https://www.linkedin.com/company/usebruno)

## Trademark

**Name**

`Bruno` is a trademark held by [Anoop M D](https://www.helloanoop.com/)

**Logo**

The logo is sourced from [OpenMoji](https://openmoji.org/library/emoji-1F436/). License: CC [BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

## Contribute 👩‍💻🧑‍💻

I am happy that you are looking to improve bruno. Please check out the [contributing guide](contributing.md)

Even if you are not able to make contributions via code, please don't hesitate to file bugs and feature requests that needs to be implemented to solve your use case.

## Authors

<div align="center">
    <a href="https://github.com/usebruno/bruno/graphs/contributors">
        <img src="https://contrib.rocks/image?repo=usebruno/bruno" />
    </a>
</div>

## License 📄

[MIT](license.md)
