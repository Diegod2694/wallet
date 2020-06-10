import * as Redux from 'redux'
import { persistStore, persistCombineReducers } from 'redux-persist'
// @ts-expect-error
import _createSensitiveStorage from 'redux-persist-sensitive-storage'
import * as Common from 'shock-common'
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
 * @typedef {{
 *   [K in keyof Common.Store.State]: Redux.Reducer<Common.Store.State[K], Common.Store.Actions.ShockAction>
 * }} ReducersObj
 */

/**
 *
 * @param {ReducersObj} reducers
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
    // @ts-expect-error TODO
    combineReducers: persistedCombineReducers,
  })

  const persistor = persistStore(store)

  setStore(store)

  SocketManager.setStore(store)

  return { persistor, store }
}
