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

        stage('Docker Build') {
            steps {
                withCredentials([
                    string(credentialsId: 'nexus-vite-supabase-url',
                           variable: 'VITE_SUPABASE_URL'),
                    string(credentialsId: 'nexus-vite-supabase-key',
                           variable: 'VITE_SUPABASE_PUBLISHABLE_KEY')
                ]) {
                    sh '''
                        docker build \
                          --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
                          --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
                          -t nexus-app:${BUILD_NUMBER} \
                          -t nexus-app:ci .
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
