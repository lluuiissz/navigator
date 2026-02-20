
export const baseURL = () => {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const port = 8000;

    if (host === 'localhost' || host === '127.0.0.1') {
        return { url: 'http://localhost:8000' };
    }

    const url = `${protocol}//${host}:${port}`;
    return { url };
}
