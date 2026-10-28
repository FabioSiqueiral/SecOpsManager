FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Directory.Build.props NuGet.Config ./
COPY src/SecOps.Domain/SecOps.Domain.csproj src/SecOps.Domain/
COPY src/SecOps.Application/SecOps.Application.csproj src/SecOps.Application/
COPY src/SecOps.Infrastructure/SecOps.Infrastructure.csproj src/SecOps.Infrastructure/
COPY src/SecOps.Api/SecOps.Api.csproj src/SecOps.Api/
RUN dotnet restore src/SecOps.Api
COPY . .
RUN dotnet publish src/SecOps.Api -c Release --no-restore -o /out
FROM mcr.microsoft.com/dotnet/aspnet:8.0
USER root
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out .
RUN mkdir /app/storage && chown -R app:app /app
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "SecOps.Api.dll"]
