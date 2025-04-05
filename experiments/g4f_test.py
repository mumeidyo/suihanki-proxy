import g4f
import asyncio

async def test_g4f():
    print("Available providers:", g4f.Provider.__all__)
    
    # Test functionality
    response = await g4f.ChatCompletion.create_async(
        model=g4f.models.gpt_35_turbo,
        messages=[{"role": "user", "content": "Hello, can you search YouTube videos about 'cute cats'?"}],
    )
    print("Response:", response)

if __name__ == "__main__":
    asyncio.run(test_g4f())
