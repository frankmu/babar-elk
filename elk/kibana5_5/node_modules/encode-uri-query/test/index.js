const expect = require('expect.js')

describe('encodeUriQuery', function() {
  it('should correctly encode uri query and not encode chars defined as pchar set in rfc3986',
      function() {
    //don't encode alphanum
    expect(encodeUriQuery('asdf1234asdf')).
      toEqual('asdf1234asdf');

    //don't encode unreserved
    expect(encodeUriQuery('-_.!~*\'() -_.!~*\'()')).
      toEqual('-_.!~*\'()+-_.!~*\'()');

    //don't encode the rest of pchar
    expect(encodeUriQuery(':@$, :@$,')).
      toEqual(':@$,+:@$,');

    //encode '&', ';', '=', '+', and '#'
    expect(encodeUriQuery('&;=+# &;=+#')).
      toEqual('%26;%3D%2B%23+%26;%3D%2B%23');

    //encode ' ' as '+'
    expect(encodeUriQuery('  ')).
      toEqual('++');

    //encode ' ' as '%20' when a flag is used
    expect(encodeUriQuery('  ', true)).
      toEqual('%20%20');

    //do not encode `null` as '+' when flag is used
    expect(encodeUriQuery('null', true)).
      toEqual('null');

    //do not encode `null` with no flag
    expect(encodeUriQuery('null')).
      toEqual('null');
  });
});
