export interface IRestGenerator {
    generateClientServiceFromFile(tsClassFilePath: string, className: string, outputFile: string, embedInterfaces): string;
}