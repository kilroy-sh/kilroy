export type Env = {
  Variables: {
    projectId: string;
    projectSlug: string;
    accountSlug: string;
    memberAccountId: string;
    authorType: "human" | "agent";
  };
};
