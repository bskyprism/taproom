/**
 * Fly.io Machines API client for managing TAP server configuration.
 * https://fly.io/docs/machines/api/machines-resource/
 */

const FLY_MACHINES_API = 'https://api.machines.dev/v1'

export interface FlyMachine {
    id:string;
    name:string;
    state:string;
    config:{
        image:string;
        env:Record<string, string>;
    };
}

export class FlyClient {
    private token:string
    private appName:string

    constructor (token:string, appName:string) {
        this.token = token
        this.appName = appName
    }

    private async request<T> (
        path:string,
        options?:RequestInit
    ):Promise<T> {
        const url = `${FLY_MACHINES_API}${path}`
        const res = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        })

        if (!res.ok) {
            const text = await res.text()
            throw new FlyApiError(text || res.statusText, res.status)
        }

        return await res.json() as T
    }

    /**
     * List all machines for the app.
     */
    async getMachines ():Promise<FlyMachine[]> {
        const machines = await this.request<FlyMachine[]>(
            `/apps/${this.appName}/machines`
        )
        return machines
    }

    /**
     * Get a specific machine's configuration.
     */
    async getMachine (machineId:string):Promise<FlyMachine> {
        return await this.request<FlyMachine>(
            `/apps/${this.appName}/machines/${machineId}`
        )
    }

    /**
     * Update a machine's environment variables.
     * This triggers a machine restart.
     */
    async updateMachineEnv (
        machineId:string,
        env:Record<string, string>
    ):Promise<FlyMachine> {
        // First get the current config
        const machine = await this.getMachine(machineId)

        // Merge new env vars with existing config
        const updatedConfig = {
            ...machine.config,
            env: {
                ...machine.config.env,
                ...env,
            },
        }

        // Update the machine with the new config
        return await this.request<FlyMachine>(
            `/apps/${this.appName}/machines/${machineId}`,
            {
                method: 'POST',
                body: JSON.stringify({ config: updatedConfig }),
            }
        )
    }

    /**
     * Get the current TAP_SIGNAL_COLLECTION value from the first machine.
     */
    async getSignalCollection ():Promise<string|null> {
        const machines = await this.getMachines()
        if (machines.length === 0) {
            return null
        }

        // Get full config for first machine
        const machine = await this.getMachine(machines[0].id)
        return machine.config.env?.TAP_SIGNAL_COLLECTION || null
    }

    /**
     * Set TAP_SIGNAL_COLLECTION on all machines.
     */
    async setSignalCollection (nsid:string):Promise<void> {
        const machines = await this.getMachines()

        // Update all machines
        await Promise.all(
            machines.map(m =>
                this.updateMachineEnv(m.id, { TAP_SIGNAL_COLLECTION: nsid })
            )
        )
    }
}

export class FlyApiError extends Error {
    status:number

    constructor (message:string, status:number) {
        super(message)
        this.name = 'FlyApiError'
        this.status = status
    }
}
