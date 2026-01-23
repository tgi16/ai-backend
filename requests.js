async function generateContent() {
  const prompt = document.getElementById("studio-topic").value.trim();
  const output = document.getElementById("output-studio");

  if (!prompt) {
    output.innerText = "Please type a topic";
    return;
  }

  output.innerText = "AI စဉ်းစားနေပါတယ်...";

  const res = await fetch("https://ai-backend-lovat-beta.vercel.app/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  const data = await res.json();

  if (data.error) {
    output.innerText = "Error: " + data.error;
  } else {
    output.innerText = data.result;
  }
}
