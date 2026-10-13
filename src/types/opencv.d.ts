/**
 * TypeScript definitions for OpenCV.js (OpenCV 5 WebAssembly)
 */

declare module '@techstark/opencv-js' {
  export interface Size {
    width: number;
    height: number;
  }

  export interface Point {
    x: number;
    y: number;
  }

  export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface Scalar {
    [index: number]: number;
  }

  export interface Moments {
    m00: number;
    m10: number;
    m01: number;
    m20: number;
    m11: number;
    m02: number;
    m30: number;
    m21: number;
    m12: number;
    m03: number;
    mu20: number;
    mu11: number;
    mu02: number;
    mu30: number;
    mu21: number;
    mu12: number;
    mu03: number;
    nu20: number;
    nu11: number;
    nu02: number;
    nu30: number;
    nu21: number;
    nu12: number;
    nu03: number;
  }

  export interface Mat {
    rows: number;
    cols: number;
    type(): number;
    channels(): number;
    depth(): number;
    data: Uint8Array;
    data8S: Int8Array;
    data16U: Uint16Array;
    data16S: Int16Array;
    data32S: Int32Array;
    data32F: Float32Array;
    data64F: Float64Array;
    ucharPtr(row: number, col: number): Uint8Array;
    roi(rect: Rect): Mat;
    clone(): Mat;
    copyTo(dst: Mat, mask?: Mat): void;
    delete(): void;
  }

  export interface MatVector {
    size(): number;
    get(index: number): Mat;
    push_back(mat: Mat): void;
    delete(): void;
  }

  export interface OpenCvModule {
    CV_8U: number;
    CV_8UC1: number;
    CV_8UC3: number;
    CV_8UC4: number;
    CV_16S: number;
    CV_32F: number;
    CV_32FC1: number;

    COLOR_RGBA2RGB: number;
    COLOR_RGBA2GRAY: number;
    COLOR_RGB2HSV: number;
    COLOR_RGBA2HSV: number;
    COLOR_BGR2GRAY: number;
    COLOR_GRAY2RGBA: number;

    MORPH_RECT: number;
    MORPH_ELLIPSE: number;
    MORPH_OPEN: number;
    MORPH_CLOSE: number;

    RETR_EXTERNAL: number;
    RETR_LIST: number;
    RETR_TREE: number;
    CHAIN_APPROX_SIMPLE: number;
    CHAIN_APPROX_NONE: number;

    BORDER_DEFAULT: number;
    BORDER_CONSTANT: number;

    TM_CCOEFF_NORMED: number;

    Mat: new (rows?: number, cols?: number, type?: number, scalar?: Scalar) => Mat;
    MatVector: new () => MatVector;
    Size: new (width: number, height: number) => Size;
    Point: new (x: number, y: number) => Point;
    Rect: new (x: number, y: number, width: number, height: number) => Rect;
    Scalar: new (v0?: number, v1?: number, v2?: number, v3?: number) => Scalar;

    matFromImageData(imageData: ImageData): Mat;
    cvtColor(src: Mat, dst: Mat, code: number): void;
    GaussianBlur(src: Mat, dst: Mat, ksize: Size, sigmaX: number, sigmaY?: number, borderType?: number): void;
    Canny(src: Mat, dst: Mat, threshold1: number, threshold2: number, apertureSize?: number, L2gradient?: boolean): void;
    Sobel(src: Mat, dst: Mat, ddepth: number, dx: number, dy: number, ksize?: number, scale?: number, delta?: number, borderType?: number): void;
    convertScaleAbs(src: Mat, dst: Mat, alpha?: number, beta?: number): void;
    addWeighted(src1: Mat, alpha: number, src2: Mat, beta: number, gamma: number, dst: Mat, dtype?: number): void;
    inRange(src: Mat, lowerb: Mat | Scalar, upperb: Mat | Scalar, dst: Mat): void;
    getStructuringElement(shape: number, ksize: Size): Mat;
    morphologyEx(src: Mat, dst: Mat, op: number, kernel: Mat): void;
    findContours(image: Mat, contours: MatVector, hierarchy: Mat, mode: number, method: number): void;
    contourArea(contour: Mat, oriented?: boolean): number;
    arcLength(curve: Mat, closed: boolean): number;
    boundingRect(points: Mat): Rect;
    moments(array: Mat, binaryImage?: boolean): Moments;
    approxPolyDP(curve: Mat, approxCurve: Mat, epsilon: number, closed: boolean): void;
    matchTemplate(image: Mat, templ: Mat, result: Mat, method: number): void;
    minMaxLoc(src: Mat): { minVal: number; maxVal: number; minLoc: Point; maxLoc: Point };
    calcHist(imageVec: MatVector, channels: number[], mask: Mat, hist: Mat, histSize: number[], ranges: number[], accumulate?: boolean): void;
    mean(src: Mat, mask?: Mat): Scalar;
    meanStdDev(src: Mat, mean: Mat, stddev: Mat, mask?: Mat): void;
    threshold(src: Mat, dst: Mat, thresh: number, maxval: number, type: number): number;

    getBuildInformation?: () => string;
    onRuntimeInitialized?: () => void;
  }

  const cvPromise: Promise<OpenCvModule>;
  export default cvPromise;
}
