nats-connection
===
It is the simple wrapper for 'nats' npm-package which implements the request/response functionality


Installation
---
NPM
```
npm install https://github.com/noguilty4you/nats-connection
```

YARN
```
yarn add https://github.com/noguilty4you/nats-connection
```


Usage
---
```
/** 
 * Client will connect automatically when its imported. 
 * All you need is provide the connection credentials using the process.env.
 * 
 * process.env.NATS_HOST, 
 * process.env.NATS_PORT,
 * process.env.NATS_USER,
 * process.env.NATS_PASS 
 * are required! 
 */

import {nats} from 'nats-connection'



/** at first we create a subscription in the first app/service/context */
nats.subscribe('SOME.SEPARATED.BY.DOTS.NAME', {queue: 'chat-backends'}, async (message, message_sender) => {

    // doing smth with message.
    // It is the same as the one stored in our message_to_send variable
    const result = { status: 'MESSAGE_RECEIVED' }  // it may be "await doVeryInterestingDealsWithMessage(message)"

    // Sending response.
    // the message_sender variable contains custom temporary nats topic name, 
    // like our 'SOME.SEPARATED.BY.DOTS.NAME' but named 'INBOX.********.********'
    // we can use that to reply to the incoming message
    nats.publish(message_sender, result)

})


/**
 * @desc Message description
 * @type {{
 *     subj: String,
 *     msg: Any,
 *     opts: {
 *         queue: String
 *     },
 *     retries: Number,
 *     timeout: Number
 * }}
 */


/** Now we'll create a simple message in the second app/service/context */
const message_to_send = {
    subj: 'SOME.SEPARATED.BY.DOTS.NAME', // for e.g the ultimate one is "CHATS.PRIVATE.SEND_MESSAGE.${user_id}"
    msg: {
        text: 'I love you',  // any type of payload
        from: {
            username: 'Mark'
        }
    },
    opts: {
        queue: 'chat-services' // optional. Nats queues are important to prevent handling one message from multiply recipients
    },
    retries: 1,
    timeout: 60000 // milliseconds. It defines the timeout of EACH request!
}

/** now we have the response from the first app/service/context */
const response = await nats.requestOne(message_to_send)

console.log(response)

// stdout: { status: 'MESSAGE_RECEIVED' }

``` 

Tested on node.js 14
