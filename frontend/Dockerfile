# Etapa 1: Build
FROM node:22-slim AS builder
LABEL com.centurylinklabs.watchtower.enable="true"

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && apt-get clean && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare yarn@3.2.3 --activate


COPY . .

RUN yarn install

ENV VITE_PUBLIC_BACKEND_URL=https://api.polkadot.lendoor.xyz
ENV VITE_PUBLIC_DYNAMIC_ENV_ID="7c0129ea-c276-419f-a158-a5ba44df52a3"

ENV VITE_PUBLIC_VLAYER_API_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnZpcm9ubWVudCI6InByb2R1Y3Rpb24iLCJpYXQiOjE3NTY2MDMxNDEsImV4cCI6MTc4ODIyNTU0MSwic3ViIjoiV0pSbzhPTzhnWU1lMFJ4T05saW02WU9Xa1hiMGlSeStqcDVhcERJZzVDQ3dRaVN1NG0raUgreFFMMG1lOUFJZkhMSWt1UWUxVnYvNkRUVTZGZjcweUE9PSJ9.F8fY_64SQ2UnP4Jm5apIhPHgU5XjAaCkksiT3I9qX68hbIq9JkuMN8SclRZFygOSBC3jiYEBTfPuErDK4EB5AecHxaxWhc4Z9SSybjBAlUXYQHRwpr3cRCkw5qALqYnCA-RmApqBK5jx27Ivo7OGB34Bxhd1fj9as1OP2Y10-yAoesnvLORh_okitk6YGsdWtIQXLP7_2s0M6Oor5-SAqvKFwqHjrckVOaCVhNqR16szzZL-86Irp8z8PezY3lV9FMcvxww9OHJU9bLSCjeSOYmjEZOBMyWus2QfGpchrAKG3jCdEKvADeC3C7BErPZaxIOflyMrdKdhc5M_xpAqoLTHcnTQkpY1lgXPapUMdTyfNkqnJDfxkOL0O4SngAysxDqmAFY1e7AlaC3tYg2JHOTGwmSNRaztmM7d5LYQ8iV-B1HesECyFAlNw-GyYCokReV0l2YKg1o9qTRgH0kf2PePsw1dRRyNy7FJus5yyYQ2wcUVVzPaikxTKvByOQ9LOi5iav9MxQY-wuR-j5mddAUFvrtqsOZ3slocn5-rNVgjq_x2jQtb0CsZVHakKtX1JLn6JhKtb_vjeOBcwt0bPP_TZmtqWQf-FULWD-vukJxAaG6CgRShLjVwnskYKAekLI5ewmgktwfj7ZTVBmritA3nhFdKFrfvwOiGpRvFu4Y"
ENV VITE_PUBLIC_VLAYER_PROVER_URL="https://stable-prod-prover.vlayer.xyz"

ENV VITE_VLAYER_AVERAGE_BALANCE_ADDRESS="0x2C244c18b9D4E24Ad3f21e6BA7bFE0fFa492aB05"

ENV VITE_LEND_MARKET="0x7913Be3D248E8Fc629F3F40a9e892A0D9ea04888"
ENV VITE_IRM="0x00F382A1E79b4159071faF7a608bD3F987cb9501"
ENV VITE_JUSDC="0x59987FD269ebf4Ec808410ad8b37E2bda879eC23"
ENV VITE_SUSDC="0x8c0a45A1a3442F6Bc3aB553942139BB575036Ab1"
ENV VITE_RISK_MANAGER_SHIM="0xd062766dB617A1C48CE6D4017776A4554DcE62CB"
ENV VITE_EVAULT_ADAPTER="0xd0602be1b9c3ED0715Be5786AD34114D9Da737BD"
ENV VITE_USDC="0x5ba1B40c2503B716BCB67c439A63BBfe3071147d"
ENV VITE_CREDIT_MANAGER_ADDRESS="0x87B6F2A7A9e371f93bBbE75926400699202B8a58"

RUN yarn build


FROM node:22-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && apt-get clean && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare yarn@3.2.3 --activate

COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./

RUN yarn install

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.ts ./


EXPOSE 3003

CMD ["yarn", "preview", "--host", "0.0.0.0", "--port", "3003"]