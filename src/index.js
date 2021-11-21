require("dotenv").config();
const fs = require("fs");
const axios = require("axios");
const { exec } = require("child_process");

function upperFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function mail(subject, html) {
    return new Promise(resolve => {
        exec(`echo "${html || ""}" | mail -s "${subject}" -aFrom:"${process.env.EMAIL_FROM}" "${process.env.EMAIL_TO}"`, (error, stdout, stderr) => {
            resolve(stdout);
        });
    });
}

async function init() {
    let last;
    try {
        last = parseInt(fs.readFileSync("data/last.txt", "utf8").trim());
    } catch (e) {
    }

    let queries = process.env.QUERY.split(",");

    let data = await axios.get(`https://www.google.com/doodles/json/${(new Date()).getFullYear()}/${(new Date()).getMonth() + 1}?hl=de&full=1`);

    for (let i = 0; i < data.data.length; i++) {
        if (data.data[i].persistent_id == last) {
            break;
        }

        let subject;

        for (let j = 0; j < queries.length; j++) {
            let doodle_type = queries[j].split(":")[0];
            let description = queries[j].split(":")[1];
            if (doodle_type &&
                description &&
                data.data[i].doodle_type.indexOf(doodle_type) != -1 &&
                data.data[i].blog_text.indexOf(description) != -1) {
                subject = upperFirst(doodle_type) + " - " + upperFirst(description);
            } else if (doodle_type && data.data[i].doodle_type.indexOf(doodle_type) != -1 && !description) {
                subject = upperFirst(doodle_type);
            } else if (description && data.data[i].blog_text.indexOf(description) != -1 && !doodle_type) {
                subject = upperFirst(description);
            }
        }

        if (subject) {
            await mail(subject, `Link: https://www.google.com/doodles/${data.data[i].name}`);
        }
    }

    try {
        fs.mkdirSync("data")
    } catch (e) {
    }

    try {
        fs.writeFileSync("data/last.txt", data.data[0].persistent_id.toString());
    } catch (e) {
        if (process.env.SEND_ERRORS === "true") {
            await mail("Error: Failed writing");
        }
    }
}

async function initWrap(...argv) {
    try {
        await init(...argv);
        process.exit();
    } catch (e) {
        console.error("An error occurred");
        console.error(argv);
        console.error(e);

        if (process.env.SEND_ERRORS === "true") {
            await mail("Error: An error occurred");
        }

        process.exit(1);
    }
}

initWrap(...process.argv.slice(2));
