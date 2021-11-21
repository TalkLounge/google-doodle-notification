# Google Doodle Notification
Send Email Notifications for Google Doodles

## Table of Contents
- [Google Doodle Notification](#google-doodle-notification)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
    - [1. Requirements](#1-requirements)
    - [2. Download](#2-download)
    - [3. Setup](#3-setup)
  - [Usage](#usage)
    - [Example](#example)
    - [Crontab](#crontab)
  - [Disclaimer](#disclaimer)
  - [License](#license)

## Installation
### 1. Requirements
* [Node.js](https://nodejs.org/en/)
* [Mailutils](https://mailutils.org/)

### 2. Download
```bash
git clone https://github.com/TalkLounge/google-doodle-notification
cd google-doodle-notification
npm install
```

### 3. Setup
* Copy [.env.example](.env.example) to [.env](.env)
* Configure [.env](.env)

## Usage
### Example
```
npm start
```

### Crontab
Can be executed via crontab every day
```
0 0 * * * cd ~/google-doodle-notification/ && npm start
```

## Disclaimer
Use on your own risk.
Google may prohibit the scraping

## License
MIT