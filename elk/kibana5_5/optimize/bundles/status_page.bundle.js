webpackJsonp([3],{

/***/ 0:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	/**
	 * Test entry file
	 *
	 * This is programatically created and updated, do not modify
	 *
	 * context: {"env":"development","urlBasePath":"/wvm","sourceMaps":"#cheap-source-map","kbnVersion":"5.5.0","buildNum":8467}
	 * includes code from:
	 *  - console@kibana
	 *  - dev_mode@kibana
	 *  - elasticsearch@kibana
	 *  - graph@5.5.0
	 *  - grokdebugger@5.5.0
	 *  - kbn_doc_views@kibana
	 *  - kbn_vislib_vis_types@kibana
	 *  - kibana@kibana
	 *  - markdown_vis@kibana
	 *  - metrics@kibana
	 *  - ml@5.5.0
	 *  - monitoring@5.5.0
	 *  - region_map@kibana
	 *  - reporting@5.5.0
	 *  - searchprofiler@5.5.0
	 *  - security@5.5.0
	 *  - spy_modes@kibana
	 *  - state_session_storage_redirect@kibana
	 *  - status_page@kibana
	 *  - table_vis@kibana
	 *  - tagcloud@kibana
	 *  - tests_bundle@kibana
	 *  - tilemap@5.5.0
	 *  - timelion@kibana
	 *  - watcher@5.5.0
	 *  - xpack_main@5.5.0
	 *
	 */

	__webpack_require__(1);
	__webpack_require__(2440);
	__webpack_require__(2854);
	__webpack_require__(2864);
	__webpack_require__(2865);
	__webpack_require__(2866);
	__webpack_require__(2869);
	__webpack_require__(2875);
	__webpack_require__(2876);
	__webpack_require__(2879);
	__webpack_require__(2881);
	__webpack_require__(2882);
	__webpack_require__(2884);
	__webpack_require__(2885);
	__webpack_require__(2401);
	__webpack_require__(2402);
	__webpack_require__(2307);
	__webpack_require__(2403);
	__webpack_require__(1).bootstrap();

/***/ },

/***/ 669:
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(670);


/***/ },

/***/ 670:
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/*!
	 * numeral.js
	 * version : 1.5.3
	 * author : Adam Draper
	 * license : MIT
	 * http://adamwdraper.github.com/Numeral-js/
	 */

	(function () {

	    /************************************
	        Constants
	    ************************************/

	    var numeral,
	        VERSION = '1.5.3',
	        // internal storage for language config files
	        languages = {},
	        currentLanguage = 'en',
	        zeroFormat = null,
	        defaultFormat = '0,0',
	        // check for nodeJS
	        hasModule = (typeof module !== 'undefined' && module.exports);


	    /************************************
	        Constructors
	    ************************************/


	    // Numeral prototype object
	    function Numeral (number) {
	        this._value = number;
	    }

	    /**
	     * Implementation of toFixed() that treats floats more like decimals
	     *
	     * Fixes binary rounding issues (eg. (0.615).toFixed(2) === '0.61') that present
	     * problems for accounting- and finance-related software.
	     */
	    function toFixed (value, precision, roundingFunction, optionals) {
	        var power = Math.pow(10, precision),
	            optionalsRegExp,
	            output;
	            
	        //roundingFunction = (roundingFunction !== undefined ? roundingFunction : Math.round);
	        // Multiply up by precision, round accurately, then divide and use native toFixed():
	        output = (roundingFunction(value * power) / power).toFixed(precision);

	        if (optionals) {
	            optionalsRegExp = new RegExp('0{1,' + optionals + '}$');
	            output = output.replace(optionalsRegExp, '');
	        }

	        return output;
	    }

	    /************************************
	        Formatting
	    ************************************/

	    // determine what type of formatting we need to do
	    function formatNumeral (n, format, roundingFunction) {
	        var output;

	        // figure out what kind of format we are dealing with
	        if (format.indexOf('$') > -1) { // currency!!!!!
	            output = formatCurrency(n, format, roundingFunction);
	        } else if (format.indexOf('%') > -1) { // percentage
	            output = formatPercentage(n, format, roundingFunction);
	        } else if (format.indexOf(':') > -1) { // time
	            output = formatTime(n, format);
	        } else { // plain ol' numbers or bytes
	            output = formatNumber(n._value, format, roundingFunction);
	        }

	        // return string
	        return output;
	    }

	    // revert to number
	    function unformatNumeral (n, string) {
	        var stringOriginal = string,
	            thousandRegExp,
	            millionRegExp,
	            billionRegExp,
	            trillionRegExp,
	            suffixes = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
	            bytesMultiplier = false,
	            power;

	        if (string.indexOf(':') > -1) {
	            n._value = unformatTime(string);
	        } else {
	            if (string === zeroFormat) {
	                n._value = 0;
	            } else {
	                if (languages[currentLanguage].delimiters.decimal !== '.') {
	                    string = string.replace(/\./g,'').replace(languages[currentLanguage].delimiters.decimal, '.');
	                }

	                // see if abbreviations are there so that we can multiply to the correct number
	                thousandRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.thousand + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');
	                millionRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.million + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');
	                billionRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.billion + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');
	                trillionRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.trillion + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');

	                // see if bytes are there so that we can multiply to the correct number
	                for (power = 0; power < suffixes.length; ++power) {
	                    bytesMultiplier = (string.indexOf(suffixes[power]) > -1) ? Math.pow(1024, power + 1) : false;

	                    if (bytesMultiplier) {
	                        break;
	                    }
	                }

	                // do some math to create our number
	                n._value = ((bytesMultiplier) ? bytesMultiplier : 1) * ((stringOriginal.match(thousandRegExp)) ? Math.pow(10, 3) : 1) * ((stringOriginal.match(millionRegExp)) ? Math.pow(10, 6) : 1) * ((stringOriginal.match(billionRegExp)) ? Math.pow(10, 9) : 1) * ((stringOriginal.match(trillionRegExp)) ? Math.pow(10, 12) : 1) * ((string.indexOf('%') > -1) ? 0.01 : 1) * (((string.split('-').length + Math.min(string.split('(').length-1, string.split(')').length-1)) % 2)? 1: -1) * Number(string.replace(/[^0-9\.]+/g, ''));

	                // round if we are talking about bytes
	                n._value = (bytesMultiplier) ? Math.ceil(n._value) : n._value;
	            }
	        }
	        return n._value;
	    }

	    function formatCurrency (n, format, roundingFunction) {
	        var symbolIndex = format.indexOf('$'),
	            openParenIndex = format.indexOf('('),
	            minusSignIndex = format.indexOf('-'),
	            space = '',
	            spliceIndex,
	            output;

	        // check for space before or after currency
	        if (format.indexOf(' $') > -1) {
	            space = ' ';
	            format = format.replace(' $', '');
	        } else if (format.indexOf('$ ') > -1) {
	            space = ' ';
	            format = format.replace('$ ', '');
	        } else {
	            format = format.replace('$', '');
	        }

	        // format the number
	        output = formatNumber(n._value, format, roundingFunction);

	        // position the symbol
	        if (symbolIndex <= 1) {
	            if (output.indexOf('(') > -1 || output.indexOf('-') > -1) {
	                output = output.split('');
	                spliceIndex = 1;
	                if (symbolIndex < openParenIndex || symbolIndex < minusSignIndex){
	                    // the symbol appears before the "(" or "-"
	                    spliceIndex = 0;
	                }
	                output.splice(spliceIndex, 0, languages[currentLanguage].currency.symbol + space);
	                output = output.join('');
	            } else {
	                output = languages[currentLanguage].currency.symbol + space + output;
	            }
	        } else {
	            if (output.indexOf(')') > -1) {
	                output = output.split('');
	                output.splice(-1, 0, space + languages[currentLanguage].currency.symbol);
	                output = output.join('');
	            } else {
	                output = output + space + languages[currentLanguage].currency.symbol;
	            }
	        }

	        return output;
	    }

	    function formatPercentage (n, format, roundingFunction) {
	        var space = '',
	            output,
	            value = n._value * 100;

	        // check for space before %
	        if (format.indexOf(' %') > -1) {
	            space = ' ';
	            format = format.replace(' %', '');
	        } else {
	            format = format.replace('%', '');
	        }

	        output = formatNumber(value, format, roundingFunction);
	        
	        if (output.indexOf(')') > -1 ) {
	            output = output.split('');
	            output.splice(-1, 0, space + '%');
	            output = output.join('');
	        } else {
	            output = output + space + '%';
	        }

	        return output;
	    }

	    function formatTime (n) {
	        var hours = Math.floor(n._value/60/60),
	            minutes = Math.floor((n._value - (hours * 60 * 60))/60),
	            seconds = Math.round(n._value - (hours * 60 * 60) - (minutes * 60));
	        return hours + ':' + ((minutes < 10) ? '0' + minutes : minutes) + ':' + ((seconds < 10) ? '0' + seconds : seconds);
	    }

	    function unformatTime (string) {
	        var timeArray = string.split(':'),
	            seconds = 0;
	        // turn hours and minutes into seconds and add them all up
	        if (timeArray.length === 3) {
	            // hours
	            seconds = seconds + (Number(timeArray[0]) * 60 * 60);
	            // minutes
	            seconds = seconds + (Number(timeArray[1]) * 60);
	            // seconds
	            seconds = seconds + Number(timeArray[2]);
	        } else if (timeArray.length === 2) {
	            // minutes
	            seconds = seconds + (Number(timeArray[0]) * 60);
	            // seconds
	            seconds = seconds + Number(timeArray[1]);
	        }
	        return Number(seconds);
	    }

	    function formatByteUnits (value) {
	        var suffixes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
	            suffix = suffixes[0],
	            power,
	            min,
	            max,
	            abs = Math.abs(value),
	            matched = (abs < 1024);

	        if (!matched) {
	            for (power = 1; power < suffixes.length; ++power) {
	                min = Math.pow(1024, power);
	                max = Math.pow(1024, power + 1);

	                if (abs >= min && abs < max) {
	                    matched = true;
	                    suffix = suffixes[power];
	                    value = value / min;
	                    break;
	                }
	            }

	            // values greater than or equal to 1024 YB
	            if (!matched) {
	                value = value / Math.pow(1024, suffixes.length - 1);
	                suffix = suffixes[suffixes.length - 1];
	            }
	        }

	        return { value: value, suffix: suffix };
	    }

	    function formatNumber (value, format, roundingFunction) {
	        var negP = false,
	            signed = false,
	            optDec = false,
	            abbr = '',
	            abbrK = false, // force abbreviation to thousands
	            abbrM = false, // force abbreviation to millions
	            abbrB = false, // force abbreviation to billions
	            abbrT = false, // force abbreviation to trillions
	            abbrForce = false, // force abbreviation
	            bytes = '',
	            units,
	            ord = '',
	            abs = Math.abs(value),
	            w,
	            precision,
	            thousands,
	            d = '',
	            neg = false;

	        // check if number is zero and a custom zero format has been set
	        if (value === 0 && zeroFormat !== null) {
	            return zeroFormat;
	        } else {
	            // see if we should use parentheses for negative number or if we should prefix with a sign
	            // if both are present we default to parentheses
	            if (format.indexOf('(') > -1) {
	                negP = true;
	                format = format.slice(1, -1);
	            } else if (format.indexOf('+') > -1) {
	                signed = true;
	                format = format.replace(/\+/g, '');
	            }

	            // see if abbreviation is wanted
	            if (format.indexOf('a') > -1) {
	                // check if abbreviation is specified
	                abbrK = format.indexOf('aK') >= 0;
	                abbrM = format.indexOf('aM') >= 0;
	                abbrB = format.indexOf('aB') >= 0;
	                abbrT = format.indexOf('aT') >= 0;
	                abbrForce = abbrK || abbrM || abbrB || abbrT;

	                // check for space before abbreviation
	                if (format.indexOf(' a') > -1) {
	                    abbr = ' ';
	                    format = format.replace(' a', '');
	                } else {
	                    format = format.replace('a', '');
	                }

	                if (abs >= Math.pow(10, 12) && !abbrForce || abbrT) {
	                    // trillion
	                    abbr = abbr + languages[currentLanguage].abbreviations.trillion;
	                    value = value / Math.pow(10, 12);
	                } else if (abs < Math.pow(10, 12) && abs >= Math.pow(10, 9) && !abbrForce || abbrB) {
	                    // billion
	                    abbr = abbr + languages[currentLanguage].abbreviations.billion;
	                    value = value / Math.pow(10, 9);
	                } else if (abs < Math.pow(10, 9) && abs >= Math.pow(10, 6) && !abbrForce || abbrM) {
	                    // million
	                    abbr = abbr + languages[currentLanguage].abbreviations.million;
	                    value = value / Math.pow(10, 6);
	                } else if (abs < Math.pow(10, 6) && abs >= Math.pow(10, 3) && !abbrForce || abbrK) {
	                    // thousand
	                    abbr = abbr + languages[currentLanguage].abbreviations.thousand;
	                    value = value / Math.pow(10, 3);
	                }
	            }

	            // see if we are formatting bytes
	            if (format.indexOf('b') > -1) {
	                // check for space before
	                if (format.indexOf(' b') > -1) {
	                    bytes = ' ';
	                    format = format.replace(' b', '');
	                } else {
	                    format = format.replace('b', '');
	                }

	                units = formatByteUnits(value);

	                value = units.value;
	                bytes = bytes + units.suffix;
	            }

	            // see if ordinal is wanted
	            if (format.indexOf('o') > -1) {
	                // check for space before
	                if (format.indexOf(' o') > -1) {
	                    ord = ' ';
	                    format = format.replace(' o', '');
	                } else {
	                    format = format.replace('o', '');
	                }

	                ord = ord + languages[currentLanguage].ordinal(value);
	            }

	            if (format.indexOf('[.]') > -1) {
	                optDec = true;
	                format = format.replace('[.]', '.');
	            }

	            w = value.toString().split('.')[0];
	            precision = format.split('.')[1];
	            thousands = format.indexOf(',');

	            if (precision) {
	                if (precision.indexOf('[') > -1) {
	                    precision = precision.replace(']', '');
	                    precision = precision.split('[');
	                    d = toFixed(value, (precision[0].length + precision[1].length), roundingFunction, precision[1].length);
	                } else {
	                    d = toFixed(value, precision.length, roundingFunction);
	                }

	                w = d.split('.')[0];

	                if (d.split('.')[1].length) {
	                    d = languages[currentLanguage].delimiters.decimal + d.split('.')[1];
	                } else {
	                    d = '';
	                }

	                if (optDec && Number(d.slice(1)) === 0) {
	                    d = '';
	                }
	            } else {
	                w = toFixed(value, null, roundingFunction);
	            }

	            // format number
	            if (w.indexOf('-') > -1) {
	                w = w.slice(1);
	                neg = true;
	            }

	            if (thousands > -1) {
	                w = w.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + languages[currentLanguage].delimiters.thousands);
	            }

	            if (format.indexOf('.') === 0) {
	                w = '';
	            }

	            return ((negP && neg) ? '(' : '') + ((!negP && neg) ? '-' : '') + ((!neg && signed) ? '+' : '') + w + d + ((ord) ? ord : '') + ((abbr) ? abbr : '') + ((bytes) ? bytes : '') + ((negP && neg) ? ')' : '');
	        }
	    }

	    /************************************
	        Top Level Functions
	    ************************************/

	    numeral = function (input) {
	        if (numeral.isNumeral(input)) {
	            input = input.value();
	        } else if (input === 0 || typeof input === 'undefined') {
	            input = 0;
	        } else if (!Number(input)) {
	            input = numeral.fn.unformat(input);
	        }

	        return new Numeral(Number(input));
	    };

	    // version number
	    numeral.version = VERSION;

	    // compare numeral object
	    numeral.isNumeral = function (obj) {
	        return obj instanceof Numeral;
	    };

	    // This function will load languages and then set the global language.  If
	    // no arguments are passed in, it will simply return the current global
	    // language key.
	    numeral.language = function (key, values) {
	        if (!key) {
	            return currentLanguage;
	        }

	        if (key && !values) {
	            if(!languages[key]) {
	                throw new Error('Unknown language : ' + key);
	            }
	            currentLanguage = key;
	        }

	        if (values || !languages[key]) {
	            loadLanguage(key, values);
	        }

	        return numeral;
	    };
	    
	    // This function provides access to the loaded language data.  If
	    // no arguments are passed in, it will simply return the current
	    // global language object.
	    numeral.languageData = function (key) {
	        if (!key) {
	            return languages[currentLanguage];
	        }
	        
	        if (!languages[key]) {
	            throw new Error('Unknown language : ' + key);
	        }
	        
	        return languages[key];
	    };

	    numeral.language('en', {
	        delimiters: {
	            thousands: ',',
	            decimal: '.'
	        },
	        abbreviations: {
	            thousand: 'k',
	            million: 'm',
	            billion: 'b',
	            trillion: 't'
	        },
	        ordinal: function (number) {
	            var b = number % 10;
	            return (~~ (number % 100 / 10) === 1) ? 'th' :
	                (b === 1) ? 'st' :
	                (b === 2) ? 'nd' :
	                (b === 3) ? 'rd' : 'th';
	        },
	        currency: {
	            symbol: '$'
	        }
	    });

	    numeral.zeroFormat = function (format) {
	        zeroFormat = typeof(format) === 'string' ? format : null;
	    };

	    numeral.defaultFormat = function (format) {
	        defaultFormat = typeof(format) === 'string' ? format : '0.0';
	    };

	    /************************************
	        Helpers
	    ************************************/

	    function loadLanguage(key, values) {
	        languages[key] = values;
	    }

	    /************************************
	        Floating-point helpers
	    ************************************/

	    // The floating-point helper functions and implementation
	    // borrows heavily from sinful.js: http://guipn.github.io/sinful.js/

	    /**
	     * Array.prototype.reduce for browsers that don't support it
	     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#Compatibility
	     */
	    if ('function' !== typeof Array.prototype.reduce) {
	        Array.prototype.reduce = function (callback, opt_initialValue) {
	            'use strict';
	            
	            if (null === this || 'undefined' === typeof this) {
	                // At the moment all modern browsers, that support strict mode, have
	                // native implementation of Array.prototype.reduce. For instance, IE8
	                // does not support strict mode, so this check is actually useless.
	                throw new TypeError('Array.prototype.reduce called on null or undefined');
	            }
	            
	            if ('function' !== typeof callback) {
	                throw new TypeError(callback + ' is not a function');
	            }

	            var index,
	                value,
	                length = this.length >>> 0,
	                isValueSet = false;

	            if (1 < arguments.length) {
	                value = opt_initialValue;
	                isValueSet = true;
	            }

	            for (index = 0; length > index; ++index) {
	                if (this.hasOwnProperty(index)) {
	                    if (isValueSet) {
	                        value = callback(value, this[index], index, this);
	                    } else {
	                        value = this[index];
	                        isValueSet = true;
	                    }
	                }
	            }

	            if (!isValueSet) {
	                throw new TypeError('Reduce of empty array with no initial value');
	            }

	            return value;
	        };
	    }

	    
	    /**
	     * Computes the multiplier necessary to make x >= 1,
	     * effectively eliminating miscalculations caused by
	     * finite precision.
	     */
	    function multiplier(x) {
	        var parts = x.toString().split('.');
	        if (parts.length < 2) {
	            return 1;
	        }
	        return Math.pow(10, parts[1].length);
	    }

	    /**
	     * Given a variable number of arguments, returns the maximum
	     * multiplier that must be used to normalize an operation involving
	     * all of them.
	     */
	    function correctionFactor() {
	        var args = Array.prototype.slice.call(arguments);
	        return args.reduce(function (prev, next) {
	            var mp = multiplier(prev),
	                mn = multiplier(next);
	        return mp > mn ? mp : mn;
	        }, -Infinity);
	    }        


	    /************************************
	        Numeral Prototype
	    ************************************/


	    numeral.fn = Numeral.prototype = {

	        clone : function () {
	            return numeral(this);
	        },

	        format : function (inputString, roundingFunction) {
	            return formatNumeral(this, 
	                  inputString ? inputString : defaultFormat, 
	                  (roundingFunction !== undefined) ? roundingFunction : Math.round
	              );
	        },

	        unformat : function (inputString) {
	            if (Object.prototype.toString.call(inputString) === '[object Number]') { 
	                return inputString; 
	            }
	            return unformatNumeral(this, inputString ? inputString : defaultFormat);
	        },

	        byteUnits : function () {
	            return formatByteUnits(this._value).suffix;
	        },

	        value : function () {
	            return this._value;
	        },

	        valueOf : function () {
	            return this._value;
	        },

	        set : function (value) {
	            this._value = Number(value);
	            return this;
	        },

	        add : function (value) {
	            var corrFactor = correctionFactor.call(null, this._value, value);
	            function cback(accum, curr, currI, O) {
	                return accum + corrFactor * curr;
	            }
	            this._value = [this._value, value].reduce(cback, 0) / corrFactor;
	            return this;
	        },

	        subtract : function (value) {
	            var corrFactor = correctionFactor.call(null, this._value, value);
	            function cback(accum, curr, currI, O) {
	                return accum - corrFactor * curr;
	            }
	            this._value = [value].reduce(cback, this._value * corrFactor) / corrFactor;            
	            return this;
	        },

	        multiply : function (value) {
	            function cback(accum, curr, currI, O) {
	                var corrFactor = correctionFactor(accum, curr);
	                return (accum * corrFactor) * (curr * corrFactor) /
	                    (corrFactor * corrFactor);
	            }
	            this._value = [this._value, value].reduce(cback, 1);
	            return this;
	        },

	        divide : function (value) {
	            function cback(accum, curr, currI, O) {
	                var corrFactor = correctionFactor(accum, curr);
	                return (accum * corrFactor) / (curr * corrFactor);
	            }
	            this._value = [this._value, value].reduce(cback);            
	            return this;
	        },

	        difference : function (value) {
	            return Math.abs(numeral(this._value).subtract(value).value());
	        }

	    };

	    /************************************
	        Exposing Numeral
	    ************************************/

	    // CommonJS module is defined
	    if (hasModule) {
	        module.exports = numeral;
	    }

	    /*global ender:false */
	    if (typeof ender === 'undefined') {
	        // here, `this` means `window` in the browser, or `global` on the server
	        // add `numeral` as a global object via a string identifier,
	        // for Closure Compiler 'advanced' mode
	        this['numeral'] = numeral;
	    }

	    /*global define:false */
	    if (true) {
	        !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function () {
	            return numeral;
	        }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	    }
	}).call(this);


/***/ },

/***/ 962:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	// Kibana UI Framework
	__webpack_require__(963);

	// All Kibana styles inside of the /styles dir
	var context = __webpack_require__(964);
	context.keys().forEach(function (key) {
	  return context(key);
	});

/***/ },

/***/ 963:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 964:
/***/ function(module, exports, __webpack_require__) {

	var map = {
		"./base.less": 965,
		"./callout.less": 966,
		"./config.less": 967,
		"./control_group.less": 968,
		"./dark-theme.less": 969,
		"./dark-variables.less": 970,
		"./hintbox.less": 971,
		"./input.less": 972,
		"./list-group-menu.less": 973,
		"./local_search.less": 974,
		"./navbar.less": 975,
		"./pagination.less": 976,
		"./sidebar.less": 977,
		"./spinner.less": 978,
		"./table.less": 979,
		"./theme.less": 980,
		"./truncate.less": 981
	};
	function webpackContext(req) {
		return __webpack_require__(webpackContextResolve(req));
	};
	function webpackContextResolve(req) {
		return map[req] || (function() { throw new Error("Cannot find module '" + req + "'.") }());
	};
	webpackContext.keys = function webpackContextKeys() {
		return Object.keys(map);
	};
	webpackContext.resolve = webpackContextResolve;
	module.exports = webpackContext;
	webpackContext.id = 964;


/***/ },

/***/ 965:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 966:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 967:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 968:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 969:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 970:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 971:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 972:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 973:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 974:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 975:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 976:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 977:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 978:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 979:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 980:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 981:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 2440:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _lodash = __webpack_require__(2);

	var _lodash2 = _interopRequireDefault(_lodash);

	var _notify = __webpack_require__(308);

	__webpack_require__(962);

	__webpack_require__(2441);

	__webpack_require__(2446);

	var _modules = __webpack_require__(19);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	var chrome = __webpack_require__(1).setRootTemplate(__webpack_require__(2447)).setRootController('ui', function ($http) {
	  var ui = this;
	  ui.loading = false;

	  ui.refresh = function () {
	    ui.loading = true;

	    // go ahead and get the info you want
	    return $http.get(chrome.addBasePath('/api/status')).then(function (resp) {

	      if (ui.fetchError) {
	        ui.fetchError.clear();
	        ui.fetchError = null;
	      }

	      var data = resp.data;
	      var metrics = data.metrics;
	      var v6Timestamp = _lodash2.default.get(metrics, 'last_updated');
	      if (v6Timestamp) {
	        var timestamp = new Date(v6Timestamp).getTime();
	        ui.metrics = {
	          heapTotal: [[timestamp, _lodash2.default.get(metrics, 'process.mem.heap_max_in_bytes')]],
	          heapUsed: [[timestamp, _lodash2.default.get(metrics, 'process.mem.heap_used_in_bytes')]],
	          load: [[timestamp, [_lodash2.default.get(metrics, 'os.cpu.load_average.1m'), _lodash2.default.get(metrics, 'os.cpu.load_average.5m'), _lodash2.default.get(metrics, 'os.cpu.load_average.15m')]]],
	          responseTimeAvg: [[timestamp, _lodash2.default.get(metrics, 'response_times.avg_in_millis')]],
	          responseTimeMax: [[timestamp, _lodash2.default.get(metrics, 'response_times.max_in_millis')]],
	          requestsPerSecond: [[timestamp, _lodash2.default.get(metrics, 'requests.total') * 1000 / _lodash2.default.get(metrics, 'collection_interval_in_millis')]]
	        };
	      } else {
	        ui.metrics = data.metrics;
	      }
	      ui.name = data.name;

	      ui.statuses = data.status.statuses;

	      var overall = data.status.overall;
	      if (!ui.serverState || ui.serverState !== overall.state) {
	        ui.serverState = overall.state;
	        ui.serverStateMessage = overall.title;
	      }
	    }).catch(function () {
	      if (ui.fetchError) return;
	      ui.fetchError = _notify.notify.error('Failed to request server ui. Perhaps your server is down?');
	      ui.metrics = ui.statuses = ui.overall = null;
	    }).then(function () {
	      ui.loading = false;
	    });
	  };

	  ui.refresh();
	});

	_modules.uiModules.get('kibana').config(function (appSwitcherEnsureNavigationProvider) {
	  appSwitcherEnsureNavigationProvider.forceNavigation(true);
	});

/***/ },

/***/ 2441:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _to_title_case = __webpack_require__(2442);

	var _to_title_case2 = _interopRequireDefault(_to_title_case);

	var _format_number = __webpack_require__(2443);

	var _format_number2 = _interopRequireDefault(_format_number);

	var _read_stat_data = __webpack_require__(2444);

	var _read_stat_data2 = _interopRequireDefault(_read_stat_data);

	var _modules = __webpack_require__(19);

	var _status_page_metric = __webpack_require__(2445);

	var _status_page_metric2 = _interopRequireDefault(_status_page_metric);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function calcAvg(metricList, metricNumberType) {
	  return metricList.map(function (data) {
	    var uglySum = data.values.reduce(function (sumSoFar, vector) {
	      return sumSoFar + vector.y;
	    }, 0);
	    return (0, _format_number2.default)(uglySum / data.values.length, metricNumberType);
	  });
	}

	_modules.uiModules.get('kibana', []).directive('statusPageMetric', function () {
	  return {
	    restrict: 'E',
	    template: _status_page_metric2.default,
	    scope: {
	      name: '@',
	      data: '='
	    },
	    controllerAs: 'metric',
	    controller: function controller($scope) {
	      var self = this;

	      self.name = $scope.name;
	      self.title = (0, _to_title_case2.default)(self.name);
	      self.extendedTitle = self.title;
	      self.numberType = 'precise';
	      self.seriesNames = [];

	      switch (self.name) {
	        case 'heapTotal':
	        case 'heapUsed':
	          self.numberType = 'byte';
	          break;

	        case 'responseTimeAvg':
	        case 'responseTimeMax':
	          self.numberType = 'ms';
	          break;

	        case 'load':
	          self.seriesNames = ['1min', '5min', '15min'];
	          break;
	      }

	      $scope.$watch('data', function (data) {
	        self.rawData = data;
	        self.chartData = (0, _read_stat_data2.default)(self.rawData, self.seriesNames);
	        self.averages = calcAvg(self.chartData, self.numberType);

	        var unit = '';
	        self.averages = self.averages.map(function (average) {
	          var parts = average.split(' ');
	          var value = parts.shift();
	          unit = parts.join(' ');
	          return value;
	        });
	        self.extendedTitle = self.title;
	        if (unit) {
	          self.extendedTitle = self.extendedTitle + ' (' + unit + ')';
	        }
	      });
	    }
	  };
	});

/***/ },

/***/ 2442:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _lodash = __webpack_require__(2);

	var _lodash2 = _interopRequireDefault(_lodash);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	// Turns thisIsASentence to
	// This Is A Sentence
	module.exports = function toTitleCase(name) {
	  return name.split(/(?=[A-Z])/).map(function (word) {
	    return word[0].toUpperCase() + _lodash2.default.rest(word).join('');
	  }).join(' ');
	};

/***/ },

/***/ 2443:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _moment = __webpack_require__(209);

	var _moment2 = _interopRequireDefault(_moment);

	var _numeral = __webpack_require__(669);

	var _numeral2 = _interopRequireDefault(_numeral);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	module.exports = function formatNumber(num, which) {
	  var format = '0.00';
	  var postfix = '';
	  switch (which) {
	    case 'time':
	      return (0, _moment2.default)(num).format('HH:mm:ss');
	    case 'byte':
	      format += ' b';
	      break;
	    case 'ms':
	      postfix = ' ms';
	      break;
	  }
	  return (0, _numeral2.default)(num).format(format) + postfix;
	};

/***/ },

/***/ 2444:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _lodash = __webpack_require__(2);

	var _lodash2 = _interopRequireDefault(_lodash);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	module.exports = function readStatData(data, seriesNames) {
	  // Metric Values format
	  // metric: [[xValue, yValue], ...]
	  // LoadMetric:
	  // metric: [[xValue, [yValue, yValue2, yValue3]], ...]
	  // return [
	  //    {type: 'line', key: name, yAxis: 1, values: [{x: xValue, y: yValue}, ...]},
	  //    {type: 'line', key: name, yAxis: 1, values: [{x: xValue, y: yValue1}, ...]},
	  //    {type: 'line', key: name, yAxis: 1, values: [{x: xValue, y: yValue2}, ...]}]
	  //
	  // Go through all of the metric values and split the values out.
	  // returns an array of all of the averages

	  var metricList = [];
	  seriesNames = seriesNames || [];
	  data.forEach(function (vector) {
	    vector = _lodash2.default.flatten(vector);
	    var x = vector.shift();
	    vector.forEach(function (yValue, i) {
	      var series = seriesNames[i] || '';

	      if (!metricList[i]) {
	        metricList[i] = {
	          key: series,
	          values: []
	        };
	      }
	      // unshift to make sure they're in the correct order
	      metricList[i].values.unshift({
	        x: x,
	        y: yValue
	      });
	    });
	  });

	  return metricList;
	};

/***/ },

/***/ 2445:
/***/ function(module, exports) {

	module.exports = "<div class=\"status_metric_wrapper col-md-4\">\n  <div class=\"content\">\n    <h3 class=\"title\">{{metric.extendedTitle}}</h3>\n    <h4 class=\"average\">{{ metric.averages.join(', ') }}</h4>\n  </div>\n</div>\n"

/***/ },

/***/ 2446:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 2447:
/***/ function(module, exports) {

	module.exports = "<div data-test-subj=\"statusPageContainer\" class=\"container overall_state_default overall_state_{{ui.serverState}}\">\n  <header>\n    <h1>\n      Status: <span class=\"overall_state_color\">{{ ui.serverStateMessage }}</span>\n      <i class=\"fa overall_state_color state_icon\" />\n      <span class=\"pull-right\">\n        {{ ui.name }}\n      </span>\n    </h1>\n  </header>\n\n  <div class=\"row metrics_wrapper\">\n    <div ng-repeat=\"(name, data) in ui.metrics\">\n      <status-page-metric name=\"{{name}}\" data=\"data\"></status-page-metric>\n    </div>\n  </div>\n\n  <div class=\"row statuses_wrapper\">\n    <h3>Status Breakdown</h3>\n\n    <div ng-if=\"!ui.statuses && ui.loading\" class=\"statuses_loading\">\n      <span class=\"spinner\"></span>\n    </div>\n\n    <h4 ng-if=\"!ui.statuses && !ui.loading\" class=\"statuses_missing\">\n      No status information available\n    </h4>\n\n    <table class=\"statuses\" data-test-subj=\"statusBreakdown\" ng-if=\"ui.statuses\">\n      <tr class=\"row\">\n        <th class=\"col-xs-4\">ID</th>\n        <th class=\"col-xs-8\">Status</th>\n      </tr>\n      <tr\n        ng-repeat=\"status in ui.statuses\"\n        class=\"status status_state_default status_state_{{status.state}} row\">\n\n        <td class=\"col-xs-4 status_id\">{{status.id}}</td>\n        <td class=\"col-xs-8 status_message\">\n          <i class=\"fa status_state_color status_state_icon\" />\n          {{status.message}}\n        </td>\n      </tr>\n    </table>\n  </div>\n</div>\n"

/***/ }

});
//# sourceMappingURL=status_page.bundle.js.map