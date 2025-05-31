export interface User {
    id: string;
    username?: string | null;
    email: string;
}

export interface UserWithPasswordHash extends User {
    passwordHash: string;
}