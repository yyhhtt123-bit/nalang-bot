const fetch = require('node-fetch'); require('dotenv').config(); async function 
testGeminiModel(apiKey, modelName) {
    // 注意：modelName 已经包含 "models/" 前缀
    const url = 
    `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
    
    try { const response = await fetch(url, { method: 'POST', headers: { 
            'Content-Type': 'application/json' }, body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }], 
                generationConfig: {
                    maxOutputTokens: 10, temperature: 0.1
                }
            }),
            timeout: 15000
        });
        
        if (response.ok) { const data = await response.json(); const text = 
            data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'; 
            console.log(`[SUCCESS] ${modelName} - Response: "${text.trim()}"`); 
            return true;
        } else {
            console.log(`[FAILED] ${modelName} - Status: ${response.status}`); return 
            false;
        }
    } catch (error) {
        console.log(`[ERROR] ${modelName} - ${error.message}`); return false;
    }
}
async function main() { const apiKeys = 
    process.env.GEMINI_API_KEYS?.split(',').filter(k => k.trim()) || []; if 
    (apiKeys.length === 0) {
        console.log('ERROR: No GEMINI_API_KEYS found'); return;
    }
    
    const apiKey = apiKeys[0]; console.log('Testing Gemini models...\n');
    
    // 先获取模型列表
    const listUrl = 
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    try { const response = await fetch(listUrl); const data = await response.json();
        
        const generateModels = data.models.filter(model => 
            model.supportedGenerationMethods?.includes('generateContent')
        );
        
        console.log(`Found ${generateModels.length} models\n`);
        
        const workingModels = [];
        
        // 测试每个模型
        for (let i = 0; i < generateModels.length; i++) { const model = 
            generateModels[i]; console.log(`[${i+1}/${generateModels.length}] Testing 
            ${model.name}`);
            
            const works = await testGeminiModel(apiKey, model.name); if (works) { 
                workingModels.push(model);
            }
            
            // 延迟避免429
            if (i < generateModels.length - 1) { await new Promise(resolve => 
                setTimeout(resolve, 2000));
            }
        }
        
        console.log('\n=== WORKING MODELS ==='); workingModels.forEach(model => { 
            console.log(`- ${model.name} (${model.displayName})`);
        });
        
        console.log('\n=== For gemini.js ==='); console.log('const modelMap = {'); 
        workingModels.forEach(model => {
            // 去掉 "models/" 前缀，用于内部映射
            const shortName = model.name.replace('models/', ''); if 
            (shortName.includes('flash')) {
                console.log(` 'gemini-flash': '${shortName}',`);
            } else if (shortName.includes('pro')) {
                console.log(` 'gemini-pro': '${shortName}',`);
            }
        });
        console.log('};');
        
    } catch (error) {
        console.log('Error:', error.message);
    }
}
main().catch(console.error);

