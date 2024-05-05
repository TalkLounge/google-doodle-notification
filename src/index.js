require("dotenv").config();
const defaults = require("defaults");
const fs = require("fs").promises;
const puppeteer = require("puppeteer-core");
const axios = require("axios");
const cheerio = require("cheerio");
const { spawn } = require("child_process");

const OPTIONS = defaults(process.env, {
    EMAIL_FROM: "",
    EMAIL_TO: "",
    SEND_ERRORS: true,
    CHROME: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    URL: "https://doodles.google/search/",
    QUERY: ""
});

async function mail(subject, html, isHtml) {
    console.log("\n[SUBJECT]:", subject);
    console.log("[BODY]:", html);

    subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`; // Otherwise email with e.g. "ä" will not be sent
    return new Promise(resolve => {
        const echo = spawn("echo", [html]);

        let args = ["-s", subject, "-a", `From:${OPTIONS.EMAIL_FROM}`, OPTIONS.EMAIL_TO];
        if (isHtml) {
            args.splice(-1, 0, "-a");
            args.splice(-1, 0, "Content-Type:text/html");
        }

        const mail = spawn("mail", args);
        echo.stdout.pipe(mail.stdin);
        mail.on("close", () => {
            resolve();
        });
    });
}

function sleep(ms) { // Thanks to https://stackoverflow.com/a/39914235
    return new Promise(resolve => setTimeout(resolve, ms));
}

function upperFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function sanitizeText(str) {
    str = str.replace(/^\s*[\r\n]/gm, ""); // Remove empty lines
    str = str.replace(/^\s+|\s+$/gm, ""); // Remove leading and trailing spaces in lines
    str = str.replace(/\n/g, " "); // To single line string
    str = str.replace(/\.(?!\s)/g, ". "); // Space after dot
    return str.trim();
}

async function getDoodle(url) {
    //const data = await axios.get("https://doodles.google/doodle/halloween-2022/"); // Interactive
    //const data = await axios.get("https://doodles.google/doodle/france-galls-76th-birthday/"); // Video
    //const data = await axios.get("https://doodles.google/doodle/teachers-day-2024-apr-13/"); // Animated Image
    //const data = await axios.get("https://doodles.google/doodle/south-africa-freedom-day-2024/"); // Image

    const data = await axios.get(url);
    const $ = cheerio.load(data.data);

    const opener = sanitizeText($(".opener").text());
    const text = sanitizeText($(".text").text());
    const description = sanitizeText($(".description").eq(0).find(".paragraph").text());
    const longDescription = sanitizeText($("[class*=long-description]").eq(0).text());

    return {
        isInteractive: $("iframe[class^=interactive]").length > 0,
        isVideo: $("#section-1 .video-player").length > 0,
        isAnimated: $(".doodle-image").attr("src").includes(".gif"),
        text: `${opener} ${text} ${description} ${longDescription}`
    }
}

async function getDoodles() {
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: OPTIONS.CHROME,
        defaultViewport: {
            width: 1280,
            height: 720
        },
        args: [
            `--window-size=1280,720`
        ]
    });

    const page = await browser.newPage();

    await page.goto(OPTIONS.URL);

    await sleep(2500);

    await page.goto(OPTIONS.URL);

    await page.waitForSelector(".doodle-card");

    const doodles = await page.$$eval(".doodle-card", doodles => {
        return doodles.map(doodle => {
            return {
                url: doodle.querySelector("a").href.trim(),
                img: doodle.querySelector("img").src.trim(),
                date: new Date(doodle.querySelector("[class*=date]").innerText).getTime(),
                title: doodle.querySelector("[class*=event]").innerText.trim()
            }
        });
    });

    await browser.close();

    return doodles;
}

function parseQuery() {
    const queryStr = OPTIONS.QUERY.split(",");
    let query = [];

    for (let i = 0; i < queryStr.length; i++) {
        let split = queryStr[i].trim().split(":");
        let type, search;

        if (split.length >= 2) {
            if (split[0].trim().length) { // Type is empty
                type = split[0].trim().toLowerCase();
            }

            split = split.slice(1);
        }

        if (split[0].trim().length) { // Search is empty
            search = split[0].trim().toLowerCase();
        }

        if (type || search) { // Type or Search is required
            query.push({ type, search });
        }
    }

    return query;
}

async function init() {
    let last;
    try {
        last = (await fs.readFile("data/last.txt", "utf8")).trim();
    } catch (e) { }

    const doodles = await getDoodles();

    const query = parseQuery();

    for (let i = 0; i < doodles.length; i++) {
        if (doodles[i].url == last) {
            break;
        }

        const doodle = await getDoodle(doodles[i].url);

        for (let j = 0; j < query.length; j++) {
            const text = `${doodles[i].title} ${doodle.text}`;

            if (
                (
                    (query[j].type == "interactive" && doodle.isInteractive) ||
                    (query[j].type == "video" && doodle.isVideo) ||
                    (query[j].type == "animated" && doodle.isAnimated) ||
                    (query[j].type == "static" && !doodle.isAnimated) ||
                    !query[j].type
                ) &&
                text.toLowerCase().indexOf(query[j].search || "") != -1) {
                await mail(
                    `${query[j].type ? upperFirst(query[j].type) + (query[j].search ? ":" : "") : ""}${query[j].search ? upperFirst(query[j].search) : ""}: ${doodles[i].title}`,
                    `<html>
<head>
    <style>
        img {
            width: 25%;
        }
    </style>
</head>
<body>
    Doodle: <a href='${doodles[i].url}'>${doodles[i].title}</a><br>
    Date: ${new Date(doodles[i].date).toLocaleDateString()}<br>
    ${query[j].search ? "Match: " + text.substring(text.toLowerCase().indexOf(query[j].search) - 25, text.toLowerCase().indexOf(query[j].search) + query[j].search.length + 25).trim() + "<br>" : ""}
    <br>
    <img src='${doodles[i].img}'>
</body>
</html>`,
                    true);

                break;
            }
        }
    }

    try {
        await fs.mkdir("data");
    } catch (e) { }

    try {
        await fs.writeFile("data/last.txt", doodles[0].url);
    } catch (e) {
        console.log("[ERROR]: An error occurred");
        console.error(e);

        if (OPTIONS.SEND_ERRORS == "true") {
            await mail("Error: Failed writing", e.stack);
        }
    }
}

async function initWrap() {
    try {
        await init();
    } catch (e) {
        console.log("[ERROR]: An error occurred");
        console.error(e);

        if (OPTIONS.SEND_ERRORS == "true") {
            await mail("Error: An error occurred", e.stack);
        }

        process.exit(1);
    }
}

initWrap();