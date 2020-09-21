


/**
 * @module nats-connection
 * @typedef {Number} Subscription
 * @desc thats the unique numeric subscription id which can be used to unsubscribe
 */

/**
 * @typedef {Object} Nats
 * @description a pub/sub
 * @property {Subscription} Subscription
 */




import {config} from './config.js'
import NATS from 'nats'
import util from 'util'
/**
 * @type {Client}
 */
const NatsClient = NATS.connect(`${config.NATS_HOST}:${config.NATS_PORT}`, {
    pedantic: true,
    json: true,
    user: config.NATS_USER,
    pass: config.NATS_PASS,
    maxReconnectAttempts: 1000,
    reconnectTimeWait: 2000,
    waitOnFirstConnect: true
})

const EVENT_HANDLERS = {
    connect: [],
    error: [],
    reconnecting: [],
    reconnect: [],
    close: []
}

/**
 * @desc It saves the provided function as a handler to provided network event
 * @param {Enum<String>} event_name - can be 'connect', 'error', 'reconnecting', 'reconnect', 'close'
 * @param {Function} handler
 */
const addNetworkEventHandler = (event_name, handler) => {

    if (!Object.keys(EVENT_HANDLERS).includes(event)) {
        throw new Error(`event_ame should be one of ${Object.keys(EVENT_HANDLERS).join(' /')} (String)`)
    }

    if (typeof handler !== 'function') {
        throw new Error('Handler should be a function')
    }

    if (!EVENT_HANDLERS[event_name].includes(handler)) {
        EVENT_HANDLERS[event_name].push(handler)
    }  else {
        console.log(`handler is already registered for event "${event_name}"`)
    }
}

let IGNORE_INCOMING_MESSAGES = false

NatsClient.on('connect', (client) => {
    if (EVENT_HANDLERS.connect.length) {
        EVENT_HANDLERS.connect.forEach(h => h(client))
    } else {
        console.log(`nats connected to ${config.NATS_HOST}:${config.NATS_PORT}`)
    }
})

NatsClient.on('error', (error) => {

    if (EVENT_HANDLERS.error.length) {
        EVENT_HANDLERS.error.forEach(h => h(error))
    } else {
        throw error
    }

})

NatsClient.on('reconnecting', (client) => {

    if (EVENT_HANDLERS.reconnecting.length) {
        EVENT_HANDLERS.reconnecting.forEach(h => h(client))
    } else {
        console.log('nats: attempting to reconnect')
    }
})
NatsClient.on('reconnect', (client) => {

    if (EVENT_HANDLERS.reconnect.length) {
        EVENT_HANDLERS.reconnect.forEach(h => h(client))
    } else {
        console.log('nats was reconnected ok')
    }
})

NatsClient.on('close', (client) => {
    if (EVENT_HANDLERS.close.length) {
        EVENT_HANDLERS.close.forEach(h => h(client))
    } else {
        console.log('nats was reconnected ok')
    }
})






/**
 *
 * It sends the default request to nats
 * using interface described in node_modules/nats/index.d.ts:182
 * @param subject {String}
 * @param message {String|Boolean|Array|Object|Symbol}
 * @param options {{
 *     queue: {String}
 * }}
 * @param timeout {Number}
 * @returns {Promise<Any>}
 */
function createOneAsyncRequestToNats (subject, message = '', options = {}, timeout = config.NATS_DEFAULT_TIMEOUT) {

    return new Promise((resolve, reject) => {
        NatsClient.requestOne(subject, message, options, timeout, (response) => {

            if (response instanceof NATS.NatsError) {
                reject(response)
            } else {
                resolve(response)
            }
        })
    })
}


/**
 * This wrapper replaces the default TIMEOUT concept of NATS
 *
 * By default, if there are no subscribers at the publishing moment,
 * the message will be
 *
 *
 * @param subj {String}
 * @param msg {String|Array|Object|Boolean}
 * @param opts {{
 *     queue: String
 * }}
 *
 * @param retries {Number} optional. If provided request will repeat the request <provided> times before returning a timeout err
 * @param timeout {Number} optional. It redefines the default nats timeout per request
 * @returns {Promise<Any>}
 */



function requestOne ({subj, msg = '', opts = {}, retries = config.NATS_DEFAULT_REQUEST_RETRIES,  timeout = config.NATS_DEFAULT_TIMEOUT}) {



    if (!subj) throw new TypeError(`Arg "subj" should be a string. Provided: ${util.inspect(subj)} (${typeof subj})`)


    /**
     * Nats.js's .requestOne() method cannot handle provided Number's as the 'msg' arg.
     * Opened issue: https://github.com/nats-io NatsClient.js/issues/296
     */
    if (typeof msg === 'number') {
        msg = String(msg)
    }


    if ( (retries || retries === 0) && (typeof retries !== 'number' || retries < 0 || isNaN(retries)) ) {
        throw new TypeError(`retries param should be a positive number. Provided: "${retries}" (${typeof retries}) `)
    }


    return new Promise(async (resolve, reject) => {


        /**
         * calculating the time when we should reject the returned promise anyway
         * e.x. if retries == 2 and timeout per request == 10000 (ms)
         * the global timeout will be calculated as 2 x 10000 = 20000 (ms)
         *
         * We'll add 100ms to global timeout to have time to get the original nat timeout error
         *
         *
         * */
        const global_request_timeout = (timeout * retries) + timeout

        /** the var to store the last timeout err from nats to pass it to the rejection method */
        let returned_request_error

        const global_timeout_timer = setTimeout(() => {

            /** using the global timeout to abort the request by timeout */
            reject(returned_request_error !== undefined ?
                returned_request_error :
                new Error(`nats: 'Request timeout after ${retries} retries and ${global_request_timeout}ms timeout`)
            )

        }, global_request_timeout)


        /** var to store any not-timeout result of the request */
        let request_result

        let retries_count = 0


        /** we will repeat the request until:
         * - first correct answer receiving
         * - global timeout will stop us
         * - retries count will be more than provided retries / default retries count
         */

        while (request_result === undefined && retries_count < retries) {

            if (retries_count > 0) {
                console.log(`nats: request to "${subj}" will be retried. Retries: ${retries_count} of ${retries}`)
            }

            retries_count++

            try {

                /** if the variable assignment will be correct,
                 * the loop will be aborted
                 */
                request_result = await createOneAsyncRequestToNats(subj, msg, opts, timeout)


            } catch (e) {


                e.nats = {subj, msg, opts, timeout}

                returned_request_error = e

                if( !(e instanceof NATS.NatsError) || !(e.code === NATS.REQ_TIMEOUT)) {
                    break
                    /** we'll break the request's loop cause it is not a timeout error */
                }
            }
            /** continuing the loop */
        }


        clearTimeout(global_timeout_timer)

        /**
         * we resolving the promise with the result of request
         * or rejecting with the request error
         */



        if (request_result !== undefined) {
            resolve(request_result)
        } else {
            /** using saved original request error to throw that */
            reject(returned_request_error !== undefined ?
                returned_request_error :
                new Error(`nats: 'Request timeout after ${retries} and ${global_request_timeout}ms`)
            )
        }

    })

}



function publish(...args) {
    const start_timestamp = Date.now()
    NatsClient.publish(...args)

    /**
     * args[0] is the subject of message.
     * In case of sending a response through the nats (nats request/response model)
     * it will starts from '_INBOX'
     */

    if (process.env.ENABLE_PERF_LOG !== 'true' || !args[0] || !args[0].split) return

    const topics = args[0].split('.')

    /** some topics with very frequent messages, like 25-50ms */
    if (topics.some(topic => { return topic ==='_INBOX' || topic === 'SELF_PING' || topic === 'GAME_STAGE' || topic === 'OFFSET' } )) return

    console.log(`nats published: ${args[0]} : ${Date.now() - start_timestamp}ms`)

}


/**
 * wrapping the subscription callback to stop all incoming messages on SIGTERM to graceful shutdown
 * @param args
 * @returns {Nats.Subscription}
 */
function subscribe (...args) {

    const params = Array.from(args)

    const subscription_callback_index = params.findIndex(arg => typeof arg === 'function')

    const original_subscription_callback = params[subscription_callback_index]

    params[subscription_callback_index] = (...data) => {

        /** todo: may be we need exceptions to keep the external http health checks alive */
        if (IGNORE_INCOMING_MESSAGES) return console.error(`nats: incoming message with ${util.inspect(data)} was ignored `)

        original_subscription_callback(...data)
    }


    const subscription = NatsClient.subscribe(...params)

    console.log(`nats: subscription to ${params[0]} created`)

    return subscription
}

function unsubscribe(...args) {

    return NatsClient.unsubscribe(...args)

}


function ignoreIncomingMessages () {
    IGNORE_INCOMING_MESSAGES = true
}

function closeConnection () {
    return NatsClient.close()
}


export const nats = {
    __NATS: NATS,             /** for customizing purposes **/
    __NatsClient: NatsClient, /** ***************************/
    addNetworkEventHandler,
    subscribe,
    unsubscribe,
    requestOne,
    publish,
    closeConnection,
    ignoreIncomingMessages
}

export const tests = {
    createOneAsyncRequestToNats
}



