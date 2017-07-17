var numeral = require('../../numeral');

exports.byteUnits = {
    bytes: function (test) {
        var power = function(exp) { return Math.pow(1024, exp); },
            tests = [
                [0, 'B'],
                [0.5, 'B'],
                [100, 'B'],
                [1023.9, 'B'],
                [1024, 'KB'],
                [power(1)*2, 'KB'],
                [power(2)*5, 'MB'],
                [power(3)*7.343, 'GB'],
                [power(4)*3.1536544, 'TB'],
                [power(5)*2.953454534534, 'PB'],
                [power(6), 'EB'],
                [power(7), 'ZB'],
                [power(8), 'YB'],
                [power(9), 'YB'], // note: it's 1024 YB
                [power(10), 'YB'] // 1024^2 YB
            ].reduce(function (tests, test) {
              tests.push(test);
              tests.push([-test[0], test[1]]);
              return tests;
            }, []),
            i;

        test.expect(tests.length);

        for (i = 0; i < tests.length; ++i) {
            test.strictEqual(numeral(tests[i][0]).byteUnits(), tests[i][1], tests[i][0] + ' ' + tests[i][1]);
        }

        test.done();
    }
};
