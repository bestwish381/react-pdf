export function download(getDocument, pdfWorker) {
  const url = window.PdfViewer.props.pdfDocument._transport._params.url;
  getDocument({ url: url, worker: new pdfWorker() })
    .promise.then((pdf) => {
      // Access the PDF document object here
      pdf.getData().then((data) => {
        const blob = new Blob([data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "file.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    })
    .catch((error) => {
      // Handle any errors that occur during loading
      console.error(error);
    });
}
