// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "AioAdeComputerUseMacOS",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "AioAdeComputerUseMacOSCore",
            targets: ["AioAdeComputerUseMacOSCore"]
        ),
        .executable(
            name: "aio-ade-computer-use-macos",
            targets: ["AioAdeComputerUseMacOS"]
        )
    ],
    targets: [
        .target(
            name: "AioAdeComputerUseMacOSCore",
            path: "Sources/AioAdeComputerUseMacOSCore"
        ),
        .executableTarget(
            name: "AioAdeComputerUseMacOS",
            dependencies: ["AioAdeComputerUseMacOSCore"],
            path: "Sources/AioAdeComputerUseMacOS"
        ),
        .testTarget(
            name: "AioAdeComputerUseMacOSTests",
            dependencies: ["AioAdeComputerUseMacOSCore"],
            path: "Tests/AioAdeComputerUseMacOSTests"
        )
    ]
)
