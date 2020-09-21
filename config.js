
/**
 * @desc nats connection configuration
 * @module nats-connection/config
 */

/**
 * Checking values we have to stop the process
 * if some of them aren't provided
 * @param obj {Object}
 * @ignore
 */
export const checkConfigToFindUndefinedValue = (obj) => {
    Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value)) {
            checkConfigToFindUndefinedValue(value)
        }

        if (value === undefined) {
            console.error(`Can not initialize .${key} in config, the current is ("${value}"). Plz check .env`)
            process.exit(1)
        }
    })
}


/**
 * it calls native Object.freeze() for the object
 * and for all embed objects recursively
 * @param obj {Object} incoming Object
 * @void
 */
export function freezeObjectDeep (obj) {

    Object.values(obj).forEach(val => {
        if (typeof val === 'object' && !Array.isArray(val)) {
            freezeObjectDeep(val)
        }
    })

    Object.freeze(obj)
}


const config = {}

/**
 * @static
 * @member NATS_HOST
 * @type string
 */
config.NATS_HOST = process.env.NATS_HOST

/**
 * @static
 * @member NATS_PORT
 * @type number
 */
config.NATS_PORT = process.env.NATS_PORT



/**
 * @static
 * @member NATS_USER
 * @type string
 */
config.NATS_USER = process.env.NATS_USER

/**
 * @static
 * @member NATS_PASS
 * @type string
 */
config.NATS_PASS = process.env.NATS_PASS


/**
 * @static
 * @member NATS_DEFAULT_TIMEOUT
 * @type Number
 */
config.NATS_DEFAULT_TIMEOUT = 10000 //ms

/**
 * @static
 * @member NATS_DEFAULT_REQUEST_RETRIES
 * @type Number
 */
config.NATS_DEFAULT_REQUEST_RETRIES = 1

/**
 * @static
 * @member NATS_DEFAULT_RETRIES_TIMEOUT
 * @type Number
 */
config.NATS_DEFAULT_RETRIES_TIMEOUT = 10000

/** ********************************** **/

checkConfigToFindUndefinedValue(config)

freezeObjectDeep(config)

export {config}
