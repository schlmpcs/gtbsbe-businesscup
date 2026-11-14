FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY services services
RUN CGO_ENABLED=0 go build -o /api ./services/api/cmd/server
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /api /api
EXPOSE 8080
ENTRYPOINT ["/api"]
