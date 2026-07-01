export type TransactionClient = Omit<
  import('@openconferences/db').PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
