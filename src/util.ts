// Base64 utilities for Workers (no Buffer)
export function uint8ArrayToBase64 (arr:Uint8Array):string {
    return btoa(String.fromCharCode(...arr))
}

export function base64ToUint8Array (base64:string):Uint8Array<ArrayBuffer> {
    const binary = atob(base64)
    const buffer = new ArrayBuffer(binary.length)
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

