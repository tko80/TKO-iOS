
private func loadLocalApp() {

    guard let resourceURL = Bundle.main.resourceURL else {
        showLoadError("App resource directory not found.")
        return
    }

    let webDirectory = resourceURL.appendingPathComponent(
        "WebApp",
        isDirectory: true
    )

    let indexURL = webDirectory.appendingPathComponent("index.html")

    guard FileManager.default.fileExists(atPath: indexURL.path) else {
        showLoadError(
            "WebApp/index.html is missing.\n\nPlease check the IPA resources."
        )
        return
    }

    print("TKO HTML:", indexURL.path)
    print("TKO HTML exists:", FileManager.default.fileExists(atPath: indexURL.path))

    webView.loadFileURL(
        indexURL,
        allowingReadAccessTo: webDirectory
    )
}
