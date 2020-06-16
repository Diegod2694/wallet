/**
 * @format
 */
import SocketIO from 'socket.io-client'
import isEmpty from 'lodash/isEmpty'
import debounce from 'lodash/debounce'
import Logger from 'react-native-file-log'
import { Constants } from 'shock-common'
// @ts-ignore
import { DISABLE_SHOCK_ENCRYPTION } from 'react-native-dotenv'

import * as Cache from '../../services/cache'
import { ACTIONS as ConnectionAction } from '../../actions/ConnectionActions'

import * as Events from './events'
import * as Encryption from '../encryption'

const { Action } = Constants

// TO DO: move to common repo
/**
 * @typedef {object} Emission
 * @prop {boolean} ok
 * @prop {any} msg
 * @prop {Record<string, any>} origBody
 */

// TO DO: move to common repo
/**
 * @typedef {object} SimpleSocket
 * @prop {(b: boolean) => SimpleSocket} binary Specifies whether the emitted
 * data contains binary. Increases performance when specified. Can be `true` or
 * `false`.
 * @prop {() => void} connect
 * @prop {boolean} connected
 * @prop {() => void} disconnect
 * @prop {boolean} disconnected
 * @prop {(eventName: string, data: Record<string, any>) => void} emit
 * @prop {(eventName: string, handler: (data: Emission) => void) => void} on
 * @prop {(eventName: string, handler: (data: Emission) => void) => void} off
 */

/**
 * @typedef {import('redux').Store<{ connection: import('../../../reducers/ConnectionReducer').State } & import('redux-persist/es/persistReducer').PersistPartial, import('redux').Action<any>> & { dispatch: any; }} ReduxStore
 */

/**
 * @type {SimpleSocket|null}
 */
// eslint-disable-next-line init-declarations
export let socket = null

/**
 * @type {ReduxStore}
 */
// eslint-disable-next-line init-declarations
export let store

/**
 * Set Redux Store for use along with end-to-end encryption
 * @param {ReduxStore} initializedStore
 * @returns {ReduxStore} Returns the initialized Redux store
 */
export const setStore = initializedStore => {
  store = initializedStore
  return store
}

/**
 * @param {object} data
 */
export const encryptSocketData = async data => {
  const { APIPublicKey } = store.getState().connection

  Logger.log('APIPublicKey', APIPublicKey)

  if (DISABLE_SHOCK_ENCRYPTION === 'true') {
    return data
  }

  if (!APIPublicKey && !isEmpty(data)) {
    throw new Error(
      'Please exchange keys with the API before sending any data through WebSockets',
    )
  }

  if (APIPublicKey && !isEmpty(data)) {
    Logger.log('encryptSocketData APIPublicKey:', APIPublicKey, data)
    const stringifiedData = JSON.stringify(data)
    const encryptedData = await Encryption.encryptData(
      stringifiedData,
      APIPublicKey,
    )
    Logger.log('Original Data:', data)
    Logger.log('Encrypted Data:', encryptedData)
    return encryptedData
  }

  return null
}

/**
 * @param {any} data
 */
export const decryptSocketData = async data => {
  if (DISABLE_SHOCK_ENCRYPTION === 'true') {
    return data
  }

  if (data?.encryptedKey) {
    const decryptionTime = Date.now()
    Logger.log('[SOCKET] Decrypting Data...', data)
    const { sessionId } = store.getState().connection
    const decryptedKey = await Encryption.decryptKey(
      data.encryptedKey,
      sessionId,
    )
    const { decryptedData } = await Encryption.decryptData({
      encryptedData: data.encryptedData,
      key: decryptedKey,
      iv: data.iv,
    })
    Logger.log(`[SOCKET] Decryption took: ${Date.now() - decryptionTime}ms`)
    return JSON.parse(decryptedData)
  }

  Logger.log('[SOCKET] Data is non-encrypted', data)

  return data
}

/**
 * @param {SocketIOClient.Socket} socket
 */
export const encryptSocketInstance = socket => ({
  connect: () => socket.connect(),
  get connected() {
    return socket.connected
  },
  // @ts-ignore
  off: () => socket.off(),
  disconnect: () => socket.disconnect(),
  get disconnected() {
    return socket.disconnected
  },
  // @ts-ignore
  binary: b => encryptSocketInstance(socket.binary(b)),
  /**
   * @param {string} eventName
   * @param {(handler: any) => void} cb
   */
  on: (eventName, cb) => {
    socket.on(
      eventName,
      /**
       * @param {any} data
       */
      async data => {
        Logger.log('Listening to Event:', eventName)

        if (Encryption.isNonEncrypted(eventName)) {
          cb(data)
          return
        }

        const decryptedData = await decryptSocketData(data).catch(err => {
          Logger.log(
            `Error decrypting data for event: ${eventName} - msg: ${err.message}`,
          )
        })

        cb(decryptedData)
      },
    )
  },
  /**
   * @param {string} eventName
   * @param {any} data
   */
  emit: async (eventName, data) => {
    if (Encryption.isNonEncrypted(eventName)) {
      socket.emit(eventName, data)
      return
    }

    Logger.log('Encrypting socket...', eventName, data)
    const encryptedData = await encryptSocketData(data)
    Logger.log('Encrypted Socket Data:', encryptedData)
    socket.emit(eventName, encryptedData)
  },
})

/**
 * Use outside of this module if need to create a single use socket.
 * @returns {Promise<SimpleSocket>}
 */
export const createSocket = async () => {
  const nodeURL = await Cache.getNodeURL()

  if (nodeURL === null) {
    throw new Error('Tried to connect the socket without a cached node url')
  }

  Logger.log(`http://${nodeURL}`)

  // @ts-ignore
  const socket = SocketIO(`http://${nodeURL}`, {
    autoConnect: true,
    reconnectionAttempts: Infinity,
    query: {
      'x-shockwallet-device-id': store.getState().connection.deviceId,
    },
  })
  return encryptSocketInstance(socket)
}

/**
 * ID for an interval that manually keeps track of the real socket connection
 * status.
 */
let connectionCheckIntervalID = -1

/**
 * The last timestamp for which the socket received some data.
 */
let lastConnCheck = 0

export const disconnect = () => {
  if (socket) {
    clearInterval(connectionCheckIntervalID)
    connectionCheckIntervalID = -1

    // @ts-ignore
    socket.off()

    store.dispatch({ type: ConnectionAction.SOCKET_DID_DISCONNECT })

    // @ts-ignore
    socket.disconnect()

    // @ts-ignore
    socket = null
  } else {
    throw new Error(
      'socket.js -> called disconnect() without calling connect() first',
    )
  }
}

/**
 * @returns {Promise<void>}
 */
export const connect = debounce(async () => {
  if (socket) {
    disconnect()
    Logger.log(
      'Tried to connect a new socket without disconnecting the old one first',
    )
  }
  const newSocket = await createSocket()
  // not a problem unless you call this function too quickly
  // eslint-disable-next-line require-atomic-updates
  socket = newSocket
  socket.on('connect_error', e => {
    // @ts-ignore
    Logger.log('connect_error: ' + e.message || e || 'Unknown')
  })

  socket.on('connect_error', error => {
    Logger.log(`connect_error: ${error}`)
  })

  socket.on('connect_timeout', timeout => {
    Logger.log(`connect_timeout: ${timeout}`)
  })

  socket.on('error', error => {
    Logger.log(`Socket.socket.on:error: ${error}`)
  })

  socket.on('reconnect_attempt', attemptNumber => {
    Logger.log(`Socket.socket.on:reconnect_attempt: ${attemptNumber}`)
  })

  socket.on('disconnect', reason => {
    Logger.log(`reason for disconnect: ${reason}`)
    store.dispatch({ type: ConnectionAction.SOCKET_DID_DISCONNECT })
  })

  socket.on('connect', () => {
    store.dispatch({ type: ConnectionAction.SOCKET_DID_CONNECT })
  })

  store.dispatch({ type: ConnectionAction.SOCKET_DID_CONNECT })

  lastConnCheck = Date.now()

  connectionCheckIntervalID = setInterval(() => {
    if (Date.now() - lastConnCheck > 10000) {
      Logger.log(
        'Socket detected as disconnected, will create a new one and set up events again',
      )
      disconnect()
      connect()
    }
  }, 10000)

  socket.on(Action.SET_LAST_SEEN_APP, () => {
    lastConnCheck = Date.now()
  })

  Events.setupEvents(socket)
}, 1000)
