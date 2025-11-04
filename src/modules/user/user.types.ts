export interface User {
  email: string;
  username: string;
  password: string;
  created_at?: Date;
}

export interface UserRegister {
  email: string;
  username: string;
  password: string;
}

export interface UserCredentials {
  email: string;
  password: string;
}
