# 紧急修复：KIND_ALIASES映射错误

## 🔴 发现的问题

在扩充 KIND_ALIASES 时，我使用了一些**不存在于manifest.json中的kind值**，导致这些别名映射失败，造成图形无法显示。

## ❌ 错误的映射

| 中文 | 错误的映射 | 正确的映射 | 说明 |
|------|-----------|-----------|------|
| 人、小人、人物 | `person` | `person_standing` | manifest中没有"person"，只有"person_sitting"和"person_standing" |
| 栅栏、木栅栏、围栏 | `fence` | `fence_wood` | manifest中的kind是"fence_wood" |
| 路、道路、小路 | `road` | `road_straight` | manifest中的kind是"road_straight" |
| 课桌 | `desk` | `table_desk` | manifest中的kind是"table_desk" |
| 河、河流 | `river` | `water_surface` | manifest中没有"river"，应该用"water_surface" |
| 帆船、船 | `sailboat` | ❌ 不存在 | manifest中根本没有sailboat |

## ✅ 已修复的映射

### 1. 人物类
```python
# 修复前
"人": "person",
"小人": "person",
"人物": "person",

# 修复后
"人": "person_standing",
"小人": "person_standing",
"人物": "person_standing",
```

### 2. 建筑结构类
```python
# 修复前
"栅栏": "fence",
"木栅栏": "fence",
"围栏": "fence",

# 修复后
"栅栏": "fence_wood",
"木栅栏": "fence_wood",
"围栏": "fence_wood",
```

### 3. 家具类
```python
# 修复前
"课桌": "desk",

# 修复后
"课桌": "table_desk",
```

### 4. 路径水域类
```python
# 修复前
"路": "road",
"道路": "road",
"小路": "road",
"河": "river",
"河流": "river",

# 修复后
"路": "road_straight",
"道路": "road_straight",
"小路": "road_straight",
"河": "water_surface",
"河流": "water_surface",
```

### 5. 交通工具类
```python
# 修复前
"帆船": "sailboat",
"船": "sailboat",

# 修复后
# 已移除（manifest中没有sailboat）
```

## 🎯 影响分析

### 修复前
当用户说以下语音命令时会失败：
- "画一个人" → 映射到"person" → ❌ 找不到SVG资源
- "添加一个栅栏" → 映射到"fence" → ❌ 找不到SVG资源
- "画一条路" → 映射到"road" → ❌ 找不到SVG资源
- "画一条河" → 映射到"river" → ❌ 找不到SVG资源
- "添加一艘帆船" → 映射到"sailboat" → ❌ 找不到SVG资源

结果：
- 如果LLM指定了`render_strategy="template"` → 显示为简单的矩形（_template_generic）
- 否则 → 显示为占位符文字"xxx（SVG待生成）"

### 修复后
所有映射都指向manifest中真实存在的kind：
- "画一个人" → `person_standing` → ✅ 显示站立的人
- "添加一个栅栏" → `fence_wood` → ✅ 显示木栅栏
- "画一条路" → `road_straight` → ✅ 显示道路
- "画一条河" → `water_surface` → ✅ 显示水面
- "添加一艘帆船" → ⚠️ 不支持（manifest中确实没有）

## 📝 验证修复

### 方法1: 运行检查脚本
```bash
python3 check_kind_mapping.py
```

应该显示：
```
✅ 所有KIND_ALIASES映射都正确
```

### 方法2: 重启后端并测试
```bash
# 重启后端
pkill -f "uvicorn app.main:app"
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

测试这些之前有问题的语音命令：
- "画一个人" ✅
- "添加一个栅栏" ✅
- "画一条路" ✅
- "画一条河" ✅

## 🔧 根本原因

在扩充KIND_ALIASES时，我：
1. **假设了kind的命名**，而没有仔细核对manifest.json
2. **使用了简化的名字**（如"person"），而manifest使用了更具体的名字（"person_standing"）
3. **添加了不存在的kind**（如"sailboat"），因为这些在TEMPLATE_KINDS中存在但没有SVG资源

## ✅ 修复文件

- `backend/app/drawing/target_resolver.py` - 修正了所有错误的kind映射

## 🎉 总结

这次修复解决了：
1. ❌ "人"相关的语音命令无法显示 → ✅ 修复
2. ❌ "栅栏"相关的语音命令无法显示 → ✅ 修复
3. ❌ "路"相关的语音命令无法显示 → ✅ 修复
4. ❌ "河"相关的语音命令无法显示 → ✅ 修复
5. ❌ "课桌"语音命令无法显示 → ✅ 修复
6. ❌ "帆船"语音命令无法显示 → ⚠️ 确认不支持（manifest中确实没有）

现在所有的KIND_ALIASES映射都指向manifest.json中真实存在的kind，图形应该能够正常显示了！
