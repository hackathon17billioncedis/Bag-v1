# Bag-v1 AI Assistant

An advanced AI-powered chatbot that leverages multiple free language models from OpenRouter to provide intelligent responses and image generation capabilities.

## Features

- 💬 Multi-model AI chatbot with various free models
- 🖼️ Image generation using Flux 2-Klein-4B model
- 🎤 Voice input and output capabilities
- 🎛️ Easy model switching interface
- 🌐 Modern, responsive UI with dark theme
- ☁️ Deployable on Vercel

## Supported Models

### Language Models
- Meta Llama 3.1 8B Instruct
- Meta Llama 3.3 70B Instruct (Free)
- Meta Llama 3.2 3B Instruct (Free)
- Google Gemma 4 26B A4B IT (Free)
- Google Gemma 4 31B IT (Free)
- Google Gemma 3N E2B IT (Free)
- Google Gemma 3N E4B IT (Free)
- Google Gemma 3 4B IT (Free)
- Google Gemma 3 12B IT (Free)
- Google Gemma 3 27B IT (Free)
- OpenAI GPT OSS 20B (Free)
- Mistral Nemo
- Mistral Small 24B Instruct 2501
- Mistral Small 3.2 24B Instruct
- Qwen3 Next 80B A3B Instruct (Free)
- Qwen3 Coder (Free)
- Qwen 2.5 7B Instruct
- Qwen3 235B A22B 2507

### Image Generation Model
- Black Forest Labs Flux.2-Klein-4B

## Installation

1. Clone the repository:
```bash
git clone https://github.com/hackathon17billioncedis/Bag-v1.git
cd Bag-v1
```

2. Install the required packages:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the root directory with your OpenRouter API key:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
APP_NAME=Bag-v1 AI Assistant
APP_URL=http://localhost:5000
```

## Usage

To run the application locally:

```bash
python app.py
```

The application will be available at [http://localhost:5000](http://localhost:5000).

## Deployment

### Vercel

This project is configured for deployment on Vercel. Simply link your GitHub repository to Vercel and deploy. Make sure to set the environment variables in the Vercel dashboard.

### Environment Variables for Production

- `OPENROUTER_API_KEY`: Your OpenRouter API key
- `APP_NAME`: The name of your application
- `APP_URL`: The URL of your deployed application

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Thanks to OpenRouter for providing access to multiple AI models
- Thanks to the open-source community for various libraries used in this project