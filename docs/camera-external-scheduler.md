# Free external camera scheduling

Status: prepared instructions, not activated. Owner prefers a free service. Existing GitHub cron scheduled every ten minutes has produced captures hours apart.

Use https://cron-job.org/en/ with an owner-controlled free account. The user must create the account and accept its terms themselves.

Create an HTTPS POST job targeting:
https://api.github.com/repos/Irisheagle76/828-weather-direct/actions/workflows/sky-camera-network.yml/dispatches

Schedule every five minutes. Request body:
{"ref":"main"}

Headers:
- Accept: application/vnd.github+json
- Content-Type: application/json
- Authorization: Bearer YOUR_SCOPED_TOKEN

Create the token in GitHub settings as a fine-grained personal access token, limited to Irisheagle76/828-weather-direct and Actions: read/write. This grants workflow-trigger capability; do not grant repository Contents write. Enter it directly into the scheduler header, never in chat, a public URL or committed files. Set an expiration and track renewal.

This service will hold that scoped token. If that is unacceptable, use a server-side proxy with its own narrow scheduler secret instead. No token or account has been created by the agent.

Use the scheduler test function, verify GitHub dispatch acceptance and then verify the published chamber-southwest.json observedAt advances. HTTP acceptance alone does not prove successful capture. Confirm several consecutive five-minute cycles before considering the cadence verified. Runner availability and upstream camera failures remain possible.

The existing workflow only publishes camera data on current main and uses [skip deploy]. Do not promote scheduled camera-data builds or change production deployment settings.

App change: foreground Live Look checks publication every 60 seconds, preloads changed images and retains the last successfully displayed still on refresh errors. This does not create new captures.

References:
https://cron-job.org/en/faq/
https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
