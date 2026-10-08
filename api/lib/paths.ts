import path from "path";

/**
 * Resolves the root of the API source/build directory.
 * When running from `api/src/` or `api/build/`, this will return `api/`.
 */
export const getApiRootDir = () => {
    // Current directory is `api/lib/` or `api/build/lib/`
    const currentDir = __dirname;
    
    if (currentDir.includes('build')) {
        return path.join(currentDir, "../../");
    }
    
    return path.join(currentDir, "../");
};

/**
 * Resolves the path to the `data` directory, currently located in `api/data/`.
 * @param filename - Optional file name inside the data directory.
 */
export const getDataPath = (filename?: string) => {
    const dataDir = path.join(getApiRootDir(), "data");
    return filename ? path.join(dataDir, filename) : dataDir;
};
