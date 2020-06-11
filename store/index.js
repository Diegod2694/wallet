import * as Redux from 'redux'
import { persistStore, persistCombineReducers } from 'redux-persist'
// @ts-expect-error
import _createSensitiveStorage from 'redux-persist-sensitive-storage'
import * as Common from 'shock-common'
import Http from 'axios'
import { RSAKeychain } from 'react-native-rsa-native'
import * as Events from '../app/services/contact-api/events'
import Big from 'big.js'
import { getToken } from '../app/services/cache'
import uuidv4 from 'uuid/v4'
/**
 * @typedef {import('redux-persist').PersistConfig<Common.Store.State>} ShockPersistConfig
 * @typedef {import('redux-persist').Storage} Storage
 */

import { setStore } from '../app/services/contact-api/socket'
import SocketManager from '../app/services/socket'

/**
 * @typedef {Redux.Reducer<Common.Store.State, Common.Store.Actions.ShockAction>} RootReducer
 */

/**
 * @param {unknown} args
 * @returns {Storage}
 */
const createSensitiveStorage = args => _createSensitiveStorage(args)

const storage = createSensitiveStorage({
  keychainService: 'ShockWalletKeychain',
  sharedPreferencesName: 'ShockWalletKeyStore',
})

/**
 * @type {ShockPersistConfig}
 */
const config = {
  key: 'root',
  // blacklist: ['connection'],
  storage,
}

/**
 * @param {Common.Store.ReducersObj} reducers
 * @returns {RootReducer}
 */
const persistedCombineReducers = reducers => {
  /**
   * @type {RootReducer}
   */
  // @ts-expect-error complains because of PersistPartial
  const persistedReducer = persistCombineReducers(config, reducers)

  return persistedReducer
}

export default () => {
  const store = Common.Store.createStore({
    Http,
    RSAKeychain,
    // @ts-expect-error
    bigConstructor: Big,
    eventProviders: {
      onChats: Events.onChats,
      onReceivedRequests: Events.onReceivedRequests,
      onSentRequests: Events.onSentRequests,
    },
    async getToken() {
      const tok = await getToken()

      if (!tok) {
        throw new Error(`token not found at store.getToken`)
      }

      return tok
    },
    uuidv4,
    // @ts-expect-error TODO
    combineReducers: persistedCombineReducers,
  })

  const persistor = persistStore(store)

  setStore(store)

  SocketManager.setStore(store)

  return { persistor, store }
}
