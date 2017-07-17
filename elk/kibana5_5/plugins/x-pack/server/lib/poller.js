import _ from 'lodash';

export class Poller {

  constructor(options) {
    this.functionToPoll = options.functionToPoll; // Must return a Promise
    this.successFunction = options.successFunction || _.noop;
    this.errorFunction = options.errorFunction || _.noop;
    this.pollFrequencyInMillis = options.pollFrequencyInMillis;
    this.continuePollingOnError = options.continuePollingOnError || false;
    this._timeoutId = null;
  }

  _poll() {
    return this.functionToPoll()
    .then(this.successFunction)
    .then(() => {
      this._timeoutId = setTimeout(this._poll.bind(this), this.pollFrequencyInMillis);
    })
    .catch(e => {
      if (this.continuePollingOnError) {
        this._timeoutId = setTimeout(this._poll.bind(this), this.pollFrequencyInMillis);
      } else {
        this.stop();
      }
      this.errorFunction(e);
    });
  }

  start() {
    if (!this.isRunning()) {
      return this._poll();
    }
  }

  stop() {
    if (this.isRunning()) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }

  isRunning() {
    return this._timeoutId !== null;
  }

}
