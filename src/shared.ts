/**
 * Shared types for Tap server management
 * https://github.com/bluesky-social/indigo/blob/main/cmd/tap/README.md
 */

export interface TapHealth {
    status:'ok'|'error';
    message?:string;
    url?:string;
}

export interface TapRepoInfo {
    did:string
    handle?:string
    pds?:string
    active:boolean
    rev?:string
    recordCount?:number
    lastSeen?:string
}

export interface TapStats {
    repoCount:number;
    recordCount:number;
    outboxBuffer:number;
    resyncBuffer:number;
    cursors:{
        firehose:number;
        listRepos:string;
    }
}

export interface AddRepoRequest {
    did:string
}

export interface RemoveRepoRequest {
    did:string
}
