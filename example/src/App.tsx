import React, { Component } from "react";
import { getDocument, PDFWorker } from 'pdfjs-dist/legacy/build/pdf';
import { PDFDocument } from "pdf-lib";
import { AnnotationFactory } from "annotpdf";
import {
  PdfLoader,
  PdfHighlighter,
  Tip,
  Highlight,
  Popup,
  AreaHighlight,
} from "./react-pdf-highlighter";

import type { IHighlight, NewHighlight } from "./react-pdf-highlighter";

import { testHighlights as _testHighlights } from "./test-highlights";
import { Spinner } from "./Spinner";
import { Sidebar } from "./Sidebar";

import "./style/App.css";

const testHighlights: Record<string, Array<IHighlight>> = _testHighlights;
declare global {
  interface Window {
    PdfViewer: any;
  }
}

interface State {
  url: string;
  highlights: Array<IHighlight>;
  pdfDocument: any;
}

const getNextId = () => String(Math.random()).slice(2);

const parseIdFromHash = () =>
  document.location.hash.slice("#highlight-".length);

const resetHash = () => {
  document.location.hash = "";
};

const HighlightPopup = ({
  comment,
}: {
  comment: { text: string; emoji: string };
}) =>
  comment.text ? (
    <div className="Highlight__popup">
      {comment.emoji} {comment.text}
    </div>
  ) : null;

const PRIMARY_PDF_URL = "https://arxiv.org/pdf/1708.08021.pdf";
// const SECONDARY_PDF_URL = "https://arxiv.org/pdf/1604.02480.pdf";

const searchParams = new URLSearchParams(document.location.search);

const initialUrl = searchParams.get("url") || PRIMARY_PDF_URL;

class App extends Component<{}, State> {
  state = {
    url: initialUrl,
    highlights: testHighlights[initialUrl]
      ? [...testHighlights[initialUrl]]
      : [],
    pdfDocument: null,
  };

  documentRef = React.createRef<HTMLElement>();
  resetHighlights = () => {
    this.setState({
      highlights: [],
    });
  };

  toggleDocument = (url: string) => {
    const newUrl =
      // this.state.url === PRIMARY_PDF_URL ? SECONDARY_PDF_URL : PRIMARY_PDF_URL;
      this.state.url = url;

    this.setState({
      url: newUrl,
      highlights: testHighlights[newUrl] ? [...testHighlights[newUrl]] : [],
    });
  };

  scrollViewerTo = (highlight: any) => { };

  saveHighlights = async () => {
    const url = window.PdfViewer.props.pdfDocument._transport._params.url;

    getDocument({ url: url, worker: new PDFWorker() })
      .promise.then(async (pdf) => {
        // Access the PDF document object here 
        pdf.getData().then(async (data) => {
          const pdfFactory = new AnnotationFactory(data);
          const pdfdoc = await PDFDocument.load(data);

          this.state.highlights.forEach((highlight) => {

            const { position, comment } = highlight;

            const { pageNumber, rects } = position;
            const page = pdfdoc.getPages()[pageNumber - 1];
            const sourcePdfWidth = page.getWidth();
            const sourcePdfHeight = page.getHeight();
            console.log("s", pageNumber);
            rects.forEach((rect: any) => {
              const { x1, y1, x2, y2 } = rect;
              const xScale = rect.width / sourcePdfWidth;
              const yScale = rect.height / sourcePdfHeight;
              pdfFactory.createHighlightAnnotation({
                page: pageNumber - 1,
                rect: [x1 / xScale, (rect.height - y1) / yScale, x2 / xScale, (rect.height - y2) / yScale],
              })
            });

            if (comment) {
              const xScale = rects[0].width / sourcePdfWidth;
              const yScale = rects[0].height / sourcePdfHeight;
              const x1 = highlight.position.rects[0].x1 / xScale;
              const y1 = (rects[0].height - highlight.position.rects[0].y1) / yScale;

              pdfFactory.createHighlightAnnotation({
                page: pageNumber - 1,
                rect: [x1, y1, x1 + 10, y1 + 10],
                contents: comment.text,
                author: "comment",
              })
              if (comment.emoji) {
                pdfFactory.createHighlightAnnotation({
                  page: pageNumber - 1,
                  rect: [x1, y1, x1 + 20, y1 + 10],
                  contents: comment.emoji,
                  author: "emoji",
                })
              }
            }
          });
          pdfFactory.download()
        });
      })
      .catch((error) => {
        // Handle any errors that occur during loading
        console.error(error);
      });
  }

  scrollToHighlightFromHash = () => {
    const highlight = this.getHighlightById(parseIdFromHash());

    if (highlight) {
      this.scrollViewerTo(highlight);
    }
  };

  componentDidMount() {
    window.addEventListener(
      "hashchange",
      this.scrollToHighlightFromHash,
      false
    );
  }

  getHighlightById(id: string) {
    const { highlights } = this.state;

    return highlights.find((highlight) => highlight.id === id);
  }

  addHighlight(highlight: NewHighlight) {
    const { highlights } = this.state;

    this.setState({
      highlights: [{ ...highlight, id: getNextId() }, ...highlights],
    });
  }

  updateHighlight(highlightId: string, position: Object, content: Object) {

    this.setState({
      highlights: this.state.highlights.map((h) => {
        const {
          id,
          position: originalPosition,
          content: originalContent,
          ...rest
        } = h;
        return id === highlightId
          ? {
            id,
            position: { ...originalPosition, ...position },
            content: { ...originalContent, ...content },
            ...rest,
          }
          : h;
      }),
    });
  }

  render() {
    const { url, highlights } = this.state;

    return (
      <div className="App" style={{ display: "flex", height: "100vh" }}>
        <Sidebar
          highlights={highlights}
          resetHighlights={this.resetHighlights}
          toggleDocument={this.toggleDocument}
          saveHighlights={this.saveHighlights}
        />
        <div
          style={{
            height: "100vh",
            width: "75vw",
            position: "relative",
          }}
        >
          <PdfLoader
            url={url} beforeLoad={<Spinner />}>
            {(pdfDocument) => {
              return <PdfHighlighter

                pdfDocument={pdfDocument}
                enableAreaSelection={(event) => event.altKey}
                onScrollChange={resetHash}
                // pdfScaleValue="page-width"
                scrollRef={(scrollTo) => {
                  this.scrollViewerTo = scrollTo;

                  this.scrollToHighlightFromHash();
                }}
                onSelectionFinished={(
                  position,
                  content,
                  hideTipAndSelection,
                  transformSelection
                ) => (
                  <Tip
                    onOpen={transformSelection}
                    onConfirm={(comment) => {
                      this.addHighlight({ content, position, comment });
                      hideTipAndSelection();
                    }}
                  />
                )}
                highlightTransform={(
                  highlight,
                  index,
                  setTip,
                  hideTip,
                  viewportToScaled,
                  screenshot,
                  isScrolledTo
                ) => {
                  const isTextHighlight = !Boolean(
                    highlight.content && highlight.content.image
                  );

                  const component = isTextHighlight ? (
                    <Highlight
                      isScrolledTo={isScrolledTo}
                      position={highlight.position}
                      comment={highlight.comment}
                    />
                  ) : (
                    <AreaHighlight
                      isScrolledTo={isScrolledTo}
                      highlight={highlight}
                      onChange={(boundingRect) => {
                        this.updateHighlight(
                          highlight.id,
                          { boundingRect: viewportToScaled(boundingRect) },
                          { image: screenshot(boundingRect) }
                        );
                      }}
                    />
                  );

                  return (
                    <Popup
                      popupContent={<HighlightPopup {...highlight} />}
                      onMouseOver={(popupContent) =>
                        setTip(highlight, (highlight) => popupContent)
                      }
                      onMouseOut={hideTip}
                      key={index}
                      children={component}
                    />
                  );
                }}
                highlights={highlights}
              />
            }}
          </PdfLoader>
        </div>
      </div>
    );
  }
}

export default App;
