# ---- build ----------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY api/src/SnapClaim.Api/SnapClaim.Api.csproj api/src/SnapClaim.Api/
RUN dotnet restore api/src/SnapClaim.Api/SnapClaim.Api.csproj
COPY api/src/ api/src/
RUN dotnet publish api/src/SnapClaim.Api/SnapClaim.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---- runtime --------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
COPY db/sql ./db/sql
COPY db/seed ./db/seed
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080
USER app
ENTRYPOINT ["dotnet", "SnapClaim.Api.dll"]
