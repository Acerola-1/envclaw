#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
空气质量数据综合占比分析
"""

import re
from collections import Counter, defaultdict

# 原始数据（从终端输出解析）
raw_data = """
Beijing overall air quality index is 62<br><small>Beijing PM<sub>2.5</sub> (fine particulate matter)  AQI is 13 - Beijing PM<sub>10</sub> (respirable particulate matter)  AQI is 7 - Beijing NO<sub>2</sub> (nitrogen dioxide)  AQI is 3 - Beijing SO<sub>2</sub> (sulfur dioxide)  AQI is 1 - Beijing O<sub>3</sub> (ozone)  AQI is 62 - Beijing CO (carbon monoxide)  AQI is 3
Shanghai overall air quality index is 87<br><small>Shanghai PM<sub>2.5</sub> (fine particulate matter)  AQI is 87 - Shanghai PM<sub>10</sub> (respirable particulate matter)  AQI is 44 - Shanghai NO<sub>2</sub> (nitrogen dioxide)  AQI is 19 - Shanghai SO<sub>2</sub> (sulfur dioxide)  AQI is 5 - Shanghai O<sub>3</sub> (ozone)  AQI is 46 - Shanghai CO (carbon monoxide)  AQI is 8
Shenzhen overall air quality index is 25<br><small>Shenzhen PM<sub>2.5</sub> (fine particulate matter)  AQI is 21 - Shenzhen PM<sub>10</sub> (respirable particulate matter)  AQI is 20 - Shenzhen NO<sub>2</sub> (nitrogen dioxide)  AQI is 8 - Shenzhen SO<sub>2</sub> (sulfur dioxide)  AQI is 3 - Shenzhen O<sub>3</sub> (ozone)  AQI is 25 - Shenzhen CO (carbon monoxide)  AQI is 6
Chengdu overall air quality index is 55<br><small>Chengdu PM<sub>2.5</sub> (fine particulate matter)  AQI is 55 - Chengdu PM<sub>10</sub> (respirable particulate matter)  AQI is 20 - Chengdu NO<sub>2</sub> (nitrogen dioxide)  AQI is 4 - Chengdu SO<sub>2</sub> (sulfur dioxide)  AQI is 2 - Chengdu O<sub>3</sub> (ozone)  AQI is 38 - Chengdu CO (carbon monoxide)  AQI is 6
Hangzhou overall air quality index is 82<br><small>Hangzhou PM<sub>2.5</sub> (fine particulate matter)  AQI is 82 - Hangzhou PM<sub>10</sub> (respirable particulate matter)  AQI is 40 - Hangzhou NO<sub>2</sub> (nitrogen dioxide)  AQI is 4 - Hangzhou SO<sub>2</sub> (sulfur dioxide)  AQI is 5 - Hangzhou O<sub>3</sub> (ozone)  AQI is 63 - Hangzhou CO (carbon monoxide)  AQI is 6
Nanjing overall air quality index is 20<br><small>Nanjing PM<sub>2.5</sub> (fine particulate matter)  AQI is 13 - Nanjing PM<sub>10</sub> (respirable particulate matter)  AQI is 20 - Nanjing NO<sub>2</sub> (nitrogen dioxide)  AQI is 2 - Nanjing SO<sub>2</sub> (sulfur dioxide)  AQI is 4 - Nanjing O<sub>3</sub> (ozone)  AQI is 77 - Nanjing CO (carbon monoxide)  AQI is 4
Wuhan overall air quality index is 109<br><small>Wuhan PM<sub>2.5</sub> (fine particulate matter)  AQI is 109 - Wuhan PM<sub>10</sub> (respirable particulate matter)  AQI is 38 - Wuhan NO<sub>2</sub> (nitrogen dioxide)  AQI is 17 - Wuhan SO<sub>2</sub> (sulfur dioxide)  AQI is 2 - Wuhan O<sub>3</sub> (ozone)  AQI is n/a - Wuhan CO (carbon monoxide)  AQI is 8
Chongqing overall air quality index is 46<br><small>Chongqing PM<sub>2.5</sub> (fine particulate matter)  AQI is 46 - Chongqing PM<sub>10</sub> (respirable particulate matter)  AQI is 24 - Chongqing NO<sub>2</sub> (nitrogen dioxide)  AQI is 14 - Chongqing SO<sub>2</sub> (sulfur dioxide)  AQI is 3 - Chongqing O<sub>3</sub> (ozone)  AQI is 20 - Chongqing CO (carbon monoxide)  AQI is 7
Tianjin overall air quality index is 59<br><small>Tianjin PM<sub>2.5</sub> (fine particulate matter)  AQI is 59 - Tianjin PM<sub>10</sub> (respirable particulate matter)  AQI is 21 - Tianjin NO<sub>2</sub> (nitrogen dioxide)  AQI is 4 - Tianjin SO<sub>2</sub> (sulfur dioxide)  AQI is 2 - Tianjin O<sub>3</sub> (ozone)  AQI is 27 - Tianjin CO (carbon monoxide)  AQI is 4
Xian overall air quality index is 112<br><small>Xian PM<sub>2.5</sub> (fine particulate matter)  AQI is 112 - Xian PM<sub>10</sub> (respirable particulate matter)  AQI is 62 - Xian NO<sub>2</sub> (nitrogen dioxide)  AQI is 8 - Xian SO<sub>2</sub> (sulfur dioxide)  AQI is 2 - Xian O<sub>3</sub> (ozone)  AQI is 64 - Xian CO (carbon monoxide)  AQI is 6
Zhengzhou overall air quality index is 92<br><small>Zhengzhou PM<sub>2.5</sub> (fine particulate matter)  AQI is 76 - Zhengzhou PM<sub>10</sub> (respirable particulate matter)  AQI is 72 - Zhengzhou NO<sub>2</sub> (nitrogen dioxide)  AQI is 6 - Zhengzhou SO<sub>2</sub> (sulfur dioxide)  AQI is 2 - Zhengzhou O<sub>3</sub> (ozone)  AQI is 92 - Zhengzhou CO (carbon monoxide)  AQI is 4
Changsha overall air quality index is 74<br><small>Changsha PM<sub>2.5</sub> (fine particulate matter)  AQI is 74 - Changsha PM<sub>10</sub> (respirable particulate matter)  AQI is 39 - Changsha NO<sub>2</sub> (nitrogen dioxide)  AQI is 2 - Changsha SO<sub>2</sub> (sulfur dioxide)  AQI is 4 - Changsha O<sub>3</sub> (ozone)  AQI is 74 - Changsha CO (carbon monoxide)  AQI is 2
Jinan overall air quality index is 56<br><small>Jinan PM<sub>2.5</sub> (fine particulate matter)  AQI is 55 - Jinan PM<sub>10</sub> (respirable particulate matter)  AQI is 40 - Jinan NO<sub>2</sub> (nitrogen dioxide)  AQI is 5 - Jinan SO<sub>2</sub> (sulfur dioxide)  AQI is 3 - Jinan O<sub>3</sub> (ozone)  AQI is 56 - Jinan CO (carbon monoxide)  AQI is 0
"""

# 解析数据
results = []
for line in raw_data.strip().split('\n'):
    if not line.strip():
        continue
    
    # 提取城市名和总AQI
    overall_match = re.search(r'(\w+) overall air quality index is (\d+)', line)
    if not overall_match:
        continue
    
    city_name = overall_match.group(1)
    overall_aqi = int(overall_match.group(2))
    
    # 提取各污染物AQI
    pollutant_pattern = r'(PM<sub>2\.5</sub>|PM<sub>10</sub>|NO<sub>2</sub>|SO<sub>2</sub>|O<sub>3</sub>|CO)\s*\([^)]*\)\s*AQI is (\d+|n/a)'
    pollutants = re.findall(pollutant_pattern, line)
    
    city_pollutants = {}
    for pollutant_html, aqi_str in pollutants:
        # 简化名称
        if 'PM<sub>2.5</sub>' in pollutant_html:
            clean_name = 'PM2.5'
        elif 'PM<sub>10</sub>' in pollutant_html:
            clean_name = 'PM10'
        elif 'NO<sub>2</sub>' in pollutant_html:
            clean_name = 'NO2'
        elif 'SO<sub>2</sub>' in pollutant_html:
            clean_name = 'SO2'
        elif 'O<sub>3</sub>' in pollutant_html:
            clean_name = 'O3'
        elif 'CO' in pollutant_html:
            clean_name = 'CO'
        else:
            continue
        
        if aqi_str != 'n/a':
            city_pollutants[clean_name] = int(aqi_str)
    
    # 确定首要污染物 (AQI最高的污染物)
    if city_pollutants:
        primary_pollutant = max(city_pollutants, key=city_pollutants.get)
        
        results.append({
            "city": city_name,
            "overall_aqi": overall_aqi,
            "primary_pollutant": primary_pollutant,
            "pollutants": city_pollutants
        })

# ==================== 分析 ====================

print("=" * 70)
print("              空气质量数据综合占比分析报告")
print("=" * 70)
print(f"\n分析城市数量: {len(results)} 个")
print("数据来源: AQICN (aqicn.org)")
print("数据时间: 实时数据")

# 1. 各污染物贡献占比分析
print("\n" + "=" * 70)
print("一、各污染物贡献占比分析")
print("=" * 70)

# 计算每个城市各污染物AQI占总AQI的比例
pollutant_contribution = defaultdict(list)
for r in results:
    total = r['overall_aqi']
    if total > 0:
        for p_name, p_aqi in r['pollutants'].items():
            contribution = (p_aqi / total) * 100
            pollutant_contribution[p_name].append(contribution)

print("\n污染物平均贡献占比:")
print("-" * 50)
for p_name in ['PM2.5', 'PM10', 'NO2', 'SO2', 'O3', 'CO']:
    if p_name in pollutant_contribution:
        avg_contribution = sum(pollutant_contribution[p_name]) / len(pollutant_contribution[p_name])
        bar = "█" * int(avg_contribution / 2)
        print(f"{p_name:8s}: {avg_contribution:6.2f}% {bar}")

# 2. 首要污染物出现频次
print("\n" + "=" * 70)
print("二、首要污染物出现频次统计")
print("=" * 70)

primary_count = Counter(r['primary_pollutant'] for r in results)
total_cities = len(results)

print("\n首要污染物分布:")
print("-" * 50)
for pollutant, count in primary_count.most_common():
    percentage = (count / total_cities) * 100
    bar = "█" * count
    print(f"{pollutant:8s}: {count:2d} 个城市 ({percentage:5.1f}%) {bar}")

# 3. 空气质量等级分布
print("\n" + "=" * 70)
print("三、空气质量等级分布")
print("=" * 70)

def get_aqi_level(aqi):
    if aqi <= 50:
        return ("优 (Good)", "🟢")
    elif aqi <= 100:
        return ("良 (Moderate)", "🟡")
    elif aqi <= 150:
        return ("轻度污染 (Unhealthy for Sensitive)", "🟠")
    elif aqi <= 200:
        return ("中度污染 (Unhealthy)", "🔴")
    elif aqi <= 300:
        return ("重度污染 (Very Unhealthy)", "🟣")
    else:
        return ("严重污染 (Hazardous)", "🟤")

level_count = Counter()
level_cities = defaultdict(list)
for r in results:
    level, emoji = get_aqi_level(r['overall_aqi'])
    level_count[level] += 1
    level_cities[level].append(f"{r['city']}({r['overall_aqi']})")

print("\n空气质量等级分布:")
print("-" * 50)
for level, count in level_count.most_common():
    percentage = (count / total_cities) * 100
    _, emoji = get_aqi_level(50 if "优" in level else 100 if "良" in level else 150)
    bar = "█" * count
    print(f"{emoji} {level:35s}: {count:2d} 个城市 ({percentage:5.1f}%) {bar}")

print("\n各等级城市明细:")
print("-" * 50)
for level in ["优 (Good)", "良 (Moderate)", "轻度污染 (Unhealthy for Sensitive)", "中度污染 (Unhealthy)", "重度污染 (Very Unhealthy)"]:
    if level in level_cities:
        print(f"\n{level}:")
        print("  " + ", ".join(level_cities[level]))

# 4. 综合统计
print("\n" + "=" * 70)
print("四、综合统计摘要")
print("=" * 70)

aqi_values = [r['overall_aqi'] for r in results]
print(f"""
• 监测城市总数: {total_cities} 个
• 平均 AQI: {sum(aqi_values)/len(aqi_values):.1f}
• 最高 AQI: {max(aqi_values)} ({[r['city'] for r in results if r['overall_aqi'] == max(aqi_values)][0]})
• 最低 AQI: {min(aqi_values)} ({[r['city'] for r in results if r['overall_aqi'] == min(aqi_values)][0]})

• 首要污染物分布:""" + "".join([f"\n  {i+1}. {p} - {c} 个城市" for i, (p, c) in enumerate(primary_count.most_common())]) + """

• 空气质量达标城市 (AQI≤100): {sum(1 for a in aqi_values if a <= 100)} 个 ({sum(1 for a in aqi_values if a <= 100)/total_cities*100:.1f}%)
• 空气质量超标城市 (AQI>100): {sum(1 for a in aqi_values if a > 100)} 个 ({sum(1 for a in aqi_values if a > 100)/total_cities*100:.1f}%)
""")

# 5. 各城市详细数据
print("=" * 70)
print("五、各城市详细数据")
print("=" * 70)
print("\n{:<12s} {:>6s} {:>8s} {:>8s} {:>8s} {:>8s} {:>8s} {:>8s} {:>12s}".format(
    "城市", "总AQI", "PM2.5", "PM10", "NO2", "SO2", "O3", "CO", "首要污染物"
))
print("-" * 90)
for r in sorted(results, key=lambda x: x['overall_aqi']):
    p = r['pollutants']
    print("{:<12s} {:>6d} {:>8d} {:>8d} {:>8d} {:>8d} {:>8d} {:>8d} {:>12s}".format(
        r['city'],
        r['overall_aqi'],
        p.get('PM2.5', 0),
        p.get('PM10', 0),
        p.get('NO2', 0),
        p.get('SO2', 0),
        p.get('O3', 0),
        p.get('CO', 0),
        r['primary_pollutant']
    ))

print("\n" + "=" * 70)
print("分析完成")
print("=" * 70)
