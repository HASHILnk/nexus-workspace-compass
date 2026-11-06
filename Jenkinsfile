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
                    string(
                        credentialsId: 'nexus-vite-supabase-url',
                        variable: 'VITE_SUPABASE_URL'
                    ),
                    string(
                        credentialsId: 'nexus-vite-supabase-key',
                        variable: 'VITE_SUPABASE_PUBLISHABLE_KEY'
                    )
                ]) {
                    sh 'npm run build'
                }
            }
        }
    }

    post {
        success {
            echo 'NEXUS CI build succeeded!'
        }
        failure {
            echo 'NEXUS CI build failed. Inspect the logs.'
        }
    }
}

