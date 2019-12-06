/**
 * @prettier
 */
import React from 'react'
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
  ImageBackground,
  TouchableOpacity,
} from 'react-native'
/**
 * @typedef {import('react-navigation').NavigationScreenProp<{}>} Navigation
 */

import * as API from '../services/contact-api'
import * as Auth from '../services/auth'
import * as CSS from '../css'
import ShockDialog from '../components/ShockDialog'

export const LOGIN = 'LOGIN'

const SHOCK_LOGO_STYLE = { width: 100, height: 100 }

/** @type {number} */
// @ts-ignore
const shockBG = require('../assets/images/shock-bg.png')
/** @type {number} */
// @ts-ignore
const shockLogo = require('../assets/images/shocklogo.png')

/**
 * @typedef {object} Props
 * @prop {Navigation} navigation
 */

/**
 * @typedef {object} State
 * @prop {string} alias
 * @prop {boolean} awaitingRes
 * @prop {string} err
 * @prop {string} pass
 */

/**
 * @augments React.PureComponent<Props, State>
 */
export default class Login extends React.PureComponent {
  /**
   * @type {import('react-navigation').NavigationScreenOptions}
   */
  static navigationOptions = {
    header: null,
  }

  /** @type {State} */
  state = {
    alias: '',
    awaitingRes: true,
    err: '',
    pass: '',
  }

  componentDidMount() {
    this.willFocusSub = this.props.navigation.addListener('didFocus', () => {
      this.setState({
        awaitingRes: false,
      })
    })
  }

  componentWillUnmount() {
    this.willFocusSub.remove()
  }

  willFocusSub = {
    remove() {},
  }

  /**
   * @private
   */
  dismissDialog = () => {
    this.setState({
      err: '',
    })
  }

  /**
   * @private
   * @param {string} alias
   * @returns {void}
   */
  onChangeAlias = alias => {
    this.setState({ alias })
  }

  /**
   * @private
   * @param {string} pass
   * @returns {void}
   */
  onChangePass = pass => {
    this.setState({ pass })
  }

  /**
   * @private
   * @returns {void}
   */
  onPressUnlock = () => {
    if (this.state.awaitingRes || this.state.alias.length === 0) {
      return
    }

    this.setState(
      {
        awaitingRes: true,
      },
      () => {
        Auth.unlockWallet(this.state.alias, this.state.pass)
          .then(res => {
            API.Events.initAuthData(res)
            // Cache.writeStoredAuthData({
            //   publicKey: res.publicKey,
            //   token: res.token,
            // })
          })
          .catch(e => {
            this.setState({
              err: e.message,
            })
          })
          .finally(() => {
            this.setState({
              awaitingRes: false,
            })
          })
      },
    )
  }

  render() {
    const { alias, awaitingRes, pass } = this.state

    const enableUnlockBtn = alias.length > 0 && pass.length > 0

    return (
      <ImageBackground source={shockBG} style={styles.container}>
        <View style={styles.shockWalletLogoContainer}>
          <Image style={SHOCK_LOGO_STYLE} source={shockLogo} />
          <Text style={styles.logoText}>S H O C K W A L L E T</Text>
        </View>

        {awaitingRes ? <ActivityIndicator animating size="large" /> : null}

        {!awaitingRes ? (
          <View style={styles.shockWalletCallToActionContainer}>
            <Text style={styles.callToAction}>Unlock Wallet</Text>
          </View>
        ) : null}

        {!awaitingRes ? (
          <View style={styles.formContainer}>
            <Text style={styles.textInputFieldLabel}>Alias</Text>
            <View style={styles.textInputFieldContainer}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={this.onChangeAlias}
                style={styles.textInputField}
                value={alias}
              />
            </View>

            <Text style={styles.textInputFieldLabel}>Password</Text>
            <View style={styles.textInputFieldContainer}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={this.onChangePass}
                style={styles.textInputField}
                secureTextEntry
                value={pass}
              />
            </View>

            <TouchableOpacity
              disabled={!enableUnlockBtn}
              onPress={this.onPressUnlock}
              style={styles.connectBtn}
            >
              <Text style={styles.connectBtnText}>Connect</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <ShockDialog
          message={this.state.err}
          onRequestClose={this.dismissDialog}
          visible={!!this.state.err}
        />
      </ImageBackground>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CSS.Colors.BLUE_DARK,
    justifyContent: 'space-around',
    minHeight: 600,
    paddingLeft: 30,
    paddingRight: 30,
  },
  shockWalletLogoContainer: {
    alignItems: 'center',
  },
  shockWalletCallToActionContainer: {
    alignItems: 'center',
  },
  formContainer: {
    marginBottom: 30,
  },
  connectBtn: {
    height: 60,
    backgroundColor: CSS.Colors.ORANGE,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  connectBtnText: {
    fontSize: 15,
    letterSpacing: 1.25,
    color: CSS.Colors.TEXT_WHITE,
    fontFamily: 'Montserrat-700',
  },
  textInputFieldLabel: {
    marginBottom: 10,
    marginLeft: 15,
    color: CSS.Colors.TEXT_WHITE,
    fontFamily: 'Montserrat-600',
  },
  textInputFieldContainer: {
    flexDirection: 'row',
    backgroundColor: CSS.Colors.TEXT_WHITE,
    height: 50,
    borderRadius: 100,
    paddingLeft: 25,
    marginBottom: 25,
    elevation: 3,
    alignItems: 'center',
  },
  textInputField: {
    fontSize: 14,
    fontFamily: 'Montserrat-600',
    flex: 1,
  },
  logoText: {
    color: CSS.Colors.TEXT_WHITE,
    fontWeight: 'bold',
    fontSize: 20,
    marginTop: 10,
  },
  callToAction: {
    color: CSS.Colors.TEXT_WHITE,
    fontFamily: 'Montserrat-700',
    fontSize: 28,
  },
})
