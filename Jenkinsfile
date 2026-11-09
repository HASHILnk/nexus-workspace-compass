pipeline {
    agent any

    tools {
        nodejs 'NodeJS-22'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out NEXUS source code'
                checkout scm
            }
        }

        stage('Verify Tools') {
            steps {
                sh 'node --version'
                sh 'npm --version'
                sh 'docker version'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build') {
            steps {
                withCredentials([
                    string(credentialsId: 'nexus-vite-supabase-url',
                           variable: 'VITE_SUPABASE_URL'),
                    string(credentialsId: 'nexus-vite-supabase-key',
                           variable: 'VITE_SUPABASE_PUBLISHABLE_KEY')
                ]) {
                    sh 'npm run build'
                }
            }
        }

        stage('Docker Build and Push to ACR') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'azure-acr-sp',
                        usernameVariable: 'ACR_USERNAME',
                        passwordVariable: 'ACR_PASSWORD'
                    ),
                    string(
                        credentialsId: 'nexus-vite-supabase-url',
                        variable: 'VITE_SUPABASE_URL'
                    ),
                    string(
                        credentialsId: 'nexus-vite-supabase-key',
                        variable: 'VITE_SUPABASE_PUBLISHABLE_KEY'
                    )
                ]) {
                    sh '''
                        set -eu

                        REGISTRY="nexusbijok2026.azurecr.io"
                        IMAGE="$REGISTRY/nexus"

                        echo "$ACR_PASSWORD" | docker login "$REGISTRY" \
                          --username "$ACR_USERNAME" --password-stdin

                        docker build \
                          --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
                          --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
                          -t "$IMAGE:$BUILD_NUMBER" \
                          -t "$IMAGE:latest" .

                        docker push "$IMAGE:$BUILD_NUMBER"
                        docker push "$IMAGE:latest"

                        docker logout "$REGISTRY"
                    '''
                }
            }
        }

        stage('Deploy to Azure Container Apps') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'azure-acr-sp',
                        usernameVariable: 'AZURE_CLIENT_ID',
                        passwordVariable: 'AZURE_CLIENT_SECRET'
                    ),
                    string(
                        credentialsId: 'azure-tenant-id',
                        variable: 'AZURE_TENANT_ID'
                    )
                ]) {
                    sh '''
                        set -eu

                        docker run --rm \
                          -e AZURE_CLIENT_ID \
                          -e AZURE_CLIENT_SECRET \
                          -e AZURE_TENANT_ID \
                          -e BUILD_NUMBER \
                          mcr.microsoft.com/azure-cli:latest \
                          sh -c '
                            az login --service-principal \
                              --username "$AZURE_CLIENT_ID" \
                              --password "$AZURE_CLIENT_SECRET" \
                              --tenant "$AZURE_TENANT_ID" \
                              --output none

                            az account set --subscription "Azure subscription 1"

                            az containerapp update \
                              --name nexus-app \
                              --resource-group rg-nexus-dev \
                              --image "nexusbijok2026.azurecr.io/nexus:$BUILD_NUMBER"
                          '
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'NEXUS CI and Docker build succeeded!'
        }
        failure {
            echo 'NEXUS pipeline failed. Inspect the logs.'
        }
    }
}
