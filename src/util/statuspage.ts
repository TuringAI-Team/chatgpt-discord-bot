export type StatusIncidentType = "major_outage" | "partial_outage" | "operational" | "investigating" | "identified" | "monitoring" | "resolved";
type StatusIncidentImpact = "critical";

interface StatusPage {
    name: string,
    updatedAt: number;
}

type RawStatusPage = Omit<StatusPage, "updatedAt"> & {
    updated_at: string;
}

export interface StatusComponent {
    name: string;
    status: StatusIncidentType;
    createdAt: number;
    updatedAt: number;
}

type RawStatusComponent = Omit<StatusComponent, "updatedAt" | "createdAt"> & {
    updated_at: string;
    created_at: string;
}

export interface StatusIncident {
    name: string;
    impact: StatusIncidentImpact;
    updates: StatusIncidentUpdate[];
    createdAt: number;
    updatedAt: number;
}

type RawStatusIncident = Omit<StatusIncident, "createdAt" | "updatedAt" | "updates"> & {
    incident_updates: RawStatusIncidentUpdate[];
    created_at: string;
    updated_at: string;
}

interface StatusIncidentUpdate {
    status: StatusIncidentType;
    body: string;
    createdAt: number;
    updatedAt: number;
}

type RawStatusIncidentUpdate = Omit<StatusIncidentUpdate, "createdAt" | "updatedAt"> & {
    created_at: string;
    updated_at: string;
}

interface StatusInfo {
    indicator: "operational" | "major";
    description: string;
}

export interface StatusSummary {
    /* Information about this status page */
    page: StatusPage;

    /* List of components this status page monitors */
    components: StatusComponent[];

    /* Active and previous incidents */
    incidents: StatusIncident[];

    /* General information about the current status */
    status: StatusInfo;
}

interface StatusBodyJSON {
    page: RawStatusPage;
    components: RawStatusComponent[];
    incidents: RawStatusIncident[];
    status: StatusInfo;
}

/**
 * Get general information about a specific status page.
 * @param link Status page to fetch
 * 
 * @returns Status page information
 */
export const status = async(link: string): Promise<StatusSummary> => {
    /* API URL */
    const url: string = `${link}/api/v2/summary.json`;

    /* Fetch the status page API information. */
    const response = await fetch(url);

    /* If the status page failed to fetch, throw an error. */
    if (response.status !== 200) {
        const body: string = await response.text();
        throw new Error(`Failed to load status page with code ${response.status}: ${body}`);
    }

    /* SON response body */
    const { components, incidents, page, status }: StatusBodyJSON = await response.json();

    return {
        status,

        components: components.map(({ created_at, name, status, updated_at }) => ({
            name, status,

            createdAt: Date.parse(created_at),
            updatedAt: Date.parse(updated_at)
        })),

        incidents: incidents.map(({ created_at, impact, incident_updates, name, updated_at }) => ({
            name, impact,

            createdAt: Date.parse(created_at),
            updatedAt: Date.parse(updated_at),

            updates: incident_updates.map(({ body, created_at, status, updated_at }) => ({
                status, body,

                createdAt: Date.parse(created_at),
                updatedAt: Date.parse(updated_at)
            }))
        })),

        page: {
            name: page.name,
            updatedAt: Date.parse(page.updated_at)
        }
    };
}