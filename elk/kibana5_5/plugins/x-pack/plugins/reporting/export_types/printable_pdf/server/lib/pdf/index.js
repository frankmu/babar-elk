import path from 'path';
import _ from 'lodash';
import concat from 'concat-stream';
import Printer from 'pdfmake';

const assetPath = path.resolve(__dirname, 'assets');

class PdfMaker {
  constructor() {
    const fontPath = (filename) => path.resolve(assetPath, 'fonts', filename);
    const fonts = {
      Roboto: {
        normal: fontPath('Roboto-Regular.ttf'),
        bold: fontPath('Roboto-Medium.ttf'),
        italics: fontPath('Roboto-Italic.ttf'),
        bolditalics: fontPath('Roboto-Italic.ttf'),
      }
    };

    this._title = '';
    this._content = [];
    this._printer = new Printer(fonts);
  }

  _addContents(contents) {
    const groupCount = this._content.length;

    // inject a page break for every 2 groups on the page
    if (groupCount > 0 && groupCount % 2 === 0) {
      contents = [{
        text: '',
        pageBreak: 'after',
      }].concat(contents);
    }

    this._content.push(contents);
  }

  addImage(filePath, opts = {}) {
    const contents = [];

    if (opts.title && opts.title.length > 0) {
      contents.push({
        text: opts.title,
        style: 'heading'
      });
    }

    if (opts.description && opts.description.length > 0) {
      contents.push({
        text: opts.description,
        style: 'subheading'
      });
    }

    const img = {
      image: filePath,
      width: 500,
      alignment: 'center',
    };

    const wrappedImg = {
      table: {
        body: [
          [ img ],
        ],
      },
      layout: 'simpleBorder'
    };

    contents.push(_.assign(wrappedImg, _.omit(opts, ['title', 'description'])));

    this._addContents(contents);
  }

  addHeading(headingText, opts = {}) {
    const contents = [];
    contents.push({
      text: headingText,
      style: ['heading'].concat(opts.styles || [])
    });
    this._addContents(contents);
  }

  setTitle(title) {
    this._title = title;
  }

  generate() {
    const docTemplate = _.assign(getTemplate(this._title), { content: this._content });
    this._pdfDoc = this._printer.createPdfKitDocument(docTemplate, getDocOptions());
    return this;
  }

  getBuffer() {
    if (!this._pdfDoc) throw new Error('Document stream has not been generated');
    return new Promise((resolve, reject) => {
      const concatStream = concat(function (pdfBuffer) {
        resolve(pdfBuffer);
      });

      this._pdfDoc.on('error', reject);
      this._pdfDoc.pipe(concatStream);
      this._pdfDoc.end();
    });
  }

  getStream() {
    if (!this._pdfDoc) throw new Error('Document stream has not been generated');
    this._pdfDoc.end();
    return this._pdfDoc;
  }
};

function getTemplate(title) {
  const pageMarginTop = 40;
  const pageMarginBottom = 80;
  const pageMarginWidth = 40;

  return {
    // define page size
    pageOrientation: 'portrait',
    pageSize: 'A4',
    pageMargins: [ pageMarginWidth, pageMarginTop, pageMarginWidth, pageMarginBottom ],

    header: function () {
      return {
        margin: [ pageMarginWidth, pageMarginTop / 4, pageMarginWidth, 0 ],
        text: title,
        style: {
          color: '#aaa',
        },
        fontSize: 10,
        alignment: 'center'
      };
    },

    footer: function (currentPage, pageCount) {
      const logoPath = path.resolve(assetPath, 'img', 'logo-grey.png');
      return {
        margin: [ pageMarginWidth, pageMarginBottom / 4, pageMarginWidth, 0 ],
        alignment: 'justify',
        columns: [
          {
            width: 100,
            image: logoPath,
          }, {
            margin: [ 120, 10, 0, 0 ],
            text: 'Page ' + currentPage.toString() + ' of ' + pageCount,
            style: {
              color: '#aaa'
            },
          },
        ]
      };
    },

    styles: {
      heading: {
        alignment: 'left',
        fontSize: 14,
        bold: true,
        marginTop: 10,
        marginBottom: 5,
      },
      subheading: {
        alignment: 'left',
        italics: true,
        marginLeft: 20,
        marginBottom: 5,
      },
      warning: {
        color: '#f39c12' // same as @brand-warning in Kibana colors.less
      }
    },

    defaultStyle: {
      fontSize: 12,
      font: 'Roboto',
    },
  };
}

function getDocOptions() {
  return {
    tableLayouts: {
      simpleBorder: {
        // format is function (i, node) { ... };
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => 'silver',
        vLineColor: () => 'silver',
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      }
    }
  };
}

export const pdf = {
  create: () => new PdfMaker()
};
