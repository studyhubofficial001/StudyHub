const { Inngest } = require("inngest");

// This server only SENDS events. The Python service (Render #2) serves the functions.
// Production: set INNGEST_EVENT_KEY.   Local: set INNGEST_DEV=1 (events go to the Inngest dev server).
const inngest = new Inngest({ id: "studyhub-api" });

module.exports = { inngest };
